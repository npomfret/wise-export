import fs from "fs";
import path from "path";
import { loadConfig, sleep, authHeaders } from "./shared";

const OUTPUT_FILE = path.join(__dirname, "..", "tmp", "activities-raw.json");
const PAGE_SIZE = 500;

async function fetchAllActivities(config: ReturnType<typeof loadConfig>): Promise<any[]> {
  const url = `https://wise.com/gateway/v1/profiles/${config.profileId}/activities/list/`;
  const delay = config.delayMs ?? 1000;
  const allActivities: any[] = [];

  const since = `${config.startDate}-01T00:00:00.000Z`;
  let until = new Date().toISOString();

  console.log(`Fetching activities back to ${since}\n`);

  let page = 0;
  while (true) {
    const body = { size: PAGE_SIZE, since, until };

    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Activities fetch failed (${response.status}): ${text}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(`Unexpected response format: expected array, got ${typeof data}`);
    }

    allActivities.push(...data);
    page++;
    console.log(`  page ${page} — ${data.length} activities (${allActivities.length} total)`);

    if (data.length < PAGE_SIZE) break;

    // Paginate by moving `until` to the oldest item's timestamp
    const oldest = data[data.length - 1];
    const oldestTime = oldest.visibleOn ?? oldest.finishedOn;
    if (!oldestTime) {
      throw new Error(`Cannot paginate: last item has no visibleOn or finishedOn`);
    }
    until = oldestTime;
    await sleep(delay);
  }

  return allActivities;
}

async function main() {
  const config = loadConfig();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const activities = await fetchAllActivities(config);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(activities, null, 2));

  console.log(`\nDone — ${activities.length} activities saved to ${OUTPUT_FILE}`);
}

main();
