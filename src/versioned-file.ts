import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface FileResult {
  status: "created" | "unchanged" | "updated";
  hash: string;
  archivePath?: string;
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function writeVersionedFile(destination: string, contents: string | Buffer): FileResult {
  const next = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8");
  const hash = sha256(next);
  let previous: Buffer | undefined;
  try {
    previous = fs.readFileSync(destination);
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
  }
  const previousHash = previous === undefined ? undefined : sha256(previous);
  if (previousHash === hash) return { status: "unchanged", hash };

  const directory = path.dirname(destination);
  fs.mkdirSync(directory, { recursive: true });
  // Stage on the same filesystem so publishing the complete new file is atomic.
  const stagingDir = fs.mkdtempSync(path.join(directory, `.${path.basename(destination)}-`));
  const staged = path.join(stagingDir, "new");
  let archivePath: string | undefined;
  try {
    fs.writeFileSync(staged, next);
    if (previous !== undefined) {
      const extension = path.extname(destination);
      const stem = path.basename(destination, extension);
      archivePath = path.join(directory, `${stem}.previous-${previousHash}${extension}`);
      try {
        fs.writeFileSync(archivePath, previous, { flag: "wx" });
      } catch (error: any) {
        if (error.code !== "EEXIST") throw error;
        if (sha256(fs.readFileSync(archivePath)) !== previousHash) {
          throw new Error(`Archive contents do not match its SHA-256 filename: ${archivePath}. Current export was left untouched.`);
        }
      }
    }
    fs.renameSync(staged, destination);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  return { status: previous === undefined ? "created" : "updated", hash, archivePath };
}
