import fs from "fs";
import path from "path";

const INPUT_FILE = path.join(__dirname, "..", "tmp", "activities-raw.json");
const OUTPUT_FILE = path.join(__dirname, "..", "tmp", "activities.csv");

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseAmount(raw: string): [string, string] {
  if (!raw) return ["", ""];
  const cleaned = stripHtml(raw).replace(/,/g, "").trim();
  // e.g. "+ 9700 EUR" or "4.20 GBP"
  const match = cleaned.match(/^([+-]?\s*[\d.]+)\s+([A-Z]{3})$/);
  if (!match) return [cleaned, ""];
  return [match[1].replace(/\s/g, ""), match[2]];
}

const COLUMNS = ["date", "type", "direction", "title", "description", "amount", "currency", "secondaryAmount", "secondaryCurrency", "category", "status", "id"] as const;

function activityToRow(a: any): string[] {
  const date = (a.finishedOn ?? a.visibleOn ?? "").replace("T", " ").replace("Z", "");
  const title = stripHtml(a.shortTitle ?? a.title ?? "");
  const description = a.description ?? "";

  const direction = (a.primaryAmount ?? "").includes("<positive>") ? "credit" : "debit";
  const [amount, currency] = parseAmount(a.primaryAmount ?? "");
  const [secondaryAmount, secondaryCurrency] = parseAmount(a.secondaryAmount ?? "");

  return [
    date,
    a.type ?? "",
    direction,
    title,
    description,
    amount ?? "",
    currency ?? "",
    secondaryAmount ?? "",
    secondaryCurrency ?? "",
    a.category ?? "",
    a.status ?? "",
    a.id ?? "",
  ];
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`No raw data found at ${INPUT_FILE} — run sync:activities first.`);
    process.exit(1);
  }

  const activities: any[] = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

  if (!Array.isArray(activities)) {
    throw new Error(`Unexpected format in ${INPUT_FILE}: expected array`);
  }

  const rows = activities.map(activityToRow);
  const csv = [COLUMNS.join(","), ...rows.map(row => row.map(csvEscape).join(","))].join("\n");

  fs.writeFileSync(OUTPUT_FILE, csv);
  console.log(`${activities.length} activities → ${OUTPUT_FILE}`);
}

main();
