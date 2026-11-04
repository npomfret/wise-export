import fs from "fs";
import path from "path";

export interface Config {
  startDate: string;
  profileId: string;
  cookies: string;
  delayMs?: number;
  outputDir?: string;
  /** Legacy output directory setting, retained for existing configurations. */
  statementsDir?: string;
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

export function authHeaders(config: Config): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-access-token": "Tr4n5f3rw153",
    Cookie: config.cookies,
  };
}
