import fs from "fs";
import path from "path";

export interface Config {
  startDate: string;
  profileId: string;
  cookies: string;
  currencies: string[];
  delayMs?: number;
  statementsDir: string;
}

export function loadConfig(): Config {
  const configPath = path.join(__dirname, "..", "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Missing config.json — copy config.example.json and fill in your details.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getMonths(startDate: string): string[] {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

export function authHeaders(config: Config): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-access-token": "Tr4n5f3rw153",
    Cookie: config.cookies,
  };
}
