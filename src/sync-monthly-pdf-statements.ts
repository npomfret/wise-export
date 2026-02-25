import fs from "fs";
import path from "path";
import { Config, loadConfig, sleep, getMonths, authHeaders } from "./shared";

interface CreateResponse {
  action: {
    url: string;
    data: unknown;
  };
}

interface PendingStatement {
  month: string;
  currency: string;
  requestId: string;
}

const TMP_DIR = path.join(__dirname, "..", "tmp");
const PENDING_FILE = path.join(TMP_DIR, "pending.json");

let OUTPUT_DIR: string;

function ensureDirs(currencies: string[]) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  for (const currency of currencies) {
    fs.mkdirSync(path.join(OUTPUT_DIR, currency), { recursive: true });
  }
}

function loadPending(): PendingStatement[] {
  if (!fs.existsSync(PENDING_FILE)) return [];
  return JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
}

function savePending(pending: PendingStatement[]) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function extractRequestId(url: string): string {
  const match = url.match(/balance-statement\/([0-9a-f-]+)/);
  if (!match) throw new Error(`Could not extract request ID from: ${url}`);
  return match[1];
}

function outputPath(month: string, currency: string): string {
  return path.join(OUTPUT_DIR, currency, `${month}-01.${currency}.statement.pdf`);
}

async function fetchBalanceIds(config: Config): Promise<Record<string, number>> {
  const url = `https://wise.com/hold/v1/profiles/${config.profileId}/statements-and-reports/balance-statement/create`;

  console.log("Fetching balance IDs...");

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(config),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch balances (${response.status}): ${text}`);
  }

  const data = await response.json();

  const balancesSchema = data.schemas.find((s: any) => s.$id === "#balancesInput");
  const options: any[] = balancesSchema.properties.balances.items.oneOf;

  const mapping: Record<string, number> = {};
  for (const opt of options) {
    const code = opt.tags.find((t: string) => /^[A-Z]{3}$/.test(t));
    if (code) {
      mapping[code] = opt.const;
    }
  }

  console.log(`Available balances: ${Object.entries(mapping).map(([c, id]) => `${c}=${id}`).join(", ")}\n`);
  return mapping;
}

async function createStatement(config: Config, month: string, balanceId: number): Promise<string> {
  const [year, monthNum] = month.split("-").map(Number);

  const mm = String(monthNum).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const to = `${year}-${mm}-${String(lastDayOfMonth(year, monthNum)).padStart(2, "0")}`;

  const body = {
    dateRange: `${from},${to}`,
    from,
    to,
    balances: [balanceId],
    includeAllBalances: false,
    fileFormat: "PDF",
    splitFees: false,
    locale: "en-GB",
    schedulePeriod: "",
  };

  const url = `https://wise.com/hold/v1/profiles/${config.profileId}/statements-and-reports/balance-statement/create?action=request`;

  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create failed (${response.status}): ${text}`);
  }

  const result: CreateResponse = await response.json();
  return extractRequestId(result.action.url);
}

async function downloadStatement(config: Config, requestId: string, dest: string): Promise<void> {
  const url = `https://wise.com/gateway/v1/profiles/${config.profileId}/statement-requests/${requestId}/statement-file`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(config),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed (${response.status}): ${text}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

async function main() {
  const config = loadConfig();
  const delay = config.delayMs ?? 1000;
  if (!config.statementsDir) {
    console.error("Missing statementsDir in config.json.");
    process.exit(1);
  }
  OUTPUT_DIR = config.statementsDir.replace(/^~/, process.env.HOME!);

  const balanceMap = await fetchBalanceIds(config);

  // Validate requested currencies
  const currencies: [string, number][] = [];
  for (const code of config.currencies) {
    const id = balanceMap[code.toUpperCase()];
    if (id === undefined) {
      console.error(`Unknown currency "${code}". Available: ${Object.keys(balanceMap).join(", ")}`);
      process.exit(1);
    }
    currencies.push([code.toUpperCase(), id]);
  }

  ensureDirs(currencies.map(([c]) => c));

  const months = getMonths(config.startDate);

  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Months: ${months[0]} to ${months[months.length - 1]} (${months.length} months)`);
  console.log(`Currencies: ${currencies.map(([c]) => c).join(", ")}\n`);

  // Shared state between creator and downloader
  const pending = loadPending();
  const alreadyRequested = new Set(pending.map((p) => `${p.month}-${p.currency}`));
  const downloadQueue: PendingStatement[] = [...pending];
  let creatorDone = false;
  let downloaded = 0;
  let created = 0;

  // Creator: request all statements
  const creator = async () => {
    console.log("=== Creator: requesting statements ===\n");

    for (const [currency, balanceId] of currencies) {
      for (const month of months) {
        const key = `${month}-${currency}`;

        if (fs.existsSync(outputPath(month, currency))) {
          continue;
        }

        if (alreadyRequested.has(key)) {
          continue;
        }

        try {
          const requestId = await createStatement(config, month, balanceId);
          const stmt = { month, currency, requestId };
          pending.push(stmt);
          downloadQueue.push(stmt);
          savePending(pending);
          created++;
          console.log(`  [create]   ${key} — requested (${requestId})`);
          await sleep(delay);
        } catch (err: any) {
          console.error(`  [create]   ${key} — FAILED: ${err.message}`);
        }
      }
    }

    creatorDone = true;
    console.log(`\n  [create]   Done — ${created} statements requested.\n`);
  };

  // Downloader: poll the queue and download completed statements
  const downloader = async () => {
    // Give the creator a head start
    await sleep(delay * 3);

    console.log("=== Downloader: polling for ready statements ===\n");

    while (!creatorDone || downloadQueue.length > 0) {
      if (downloadQueue.length === 0) {
        await sleep(delay);
        continue;
      }

      const stmt = downloadQueue.shift()!;
      const dest = outputPath(stmt.month, stmt.currency);
      const key = `${stmt.month}-${stmt.currency}`;

      if (fs.existsSync(dest)) {
        downloaded++;
        continue;
      }

      try {
        await downloadStatement(config, stmt.requestId, dest);
        downloaded++;
        console.log(`  [download] ${key} — saved (${downloaded} total)`);
        await sleep(delay);
      } catch (err: any) {
        // Not ready yet or failed — put it back at the end of the queue
        downloadQueue.push(stmt);
        console.log(`  [download] ${key} — not ready, will retry`);
        await sleep(delay * 2);
      }
    }

    console.log(`  [download] Done — ${downloaded} statements saved.\n`);
  };

  await Promise.all([creator(), downloader()]);

  // Save any that never downloaded
  const remaining = downloadQueue.filter(
    (s) => !fs.existsSync(outputPath(s.month, s.currency))
  );
  savePending(remaining);

  if (remaining.length > 0) {
    console.log(`${remaining.length} statements still pending — saved to tmp/pending.json for retry.`);
  } else {
    // Clean up pending file
    savePending([]);
    console.log("All done.");
  }
}

main();
