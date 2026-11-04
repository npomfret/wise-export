import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, TestContext } from "node:test";
import { writeVersionedFile } from "../src/versioned-file";

function destination(t: TestContext): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wise-versioned-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "exports", "activities.csv");
}

test("creates the first export without an archive", t => {
  const file = destination(t);
  const result = writeVersionedFile(file, "date,amount\n2026-11-01,42");
  assert.equal(result.status, "created");
  assert.equal(result.archivePath, undefined);
  assert.match(result.hash, /^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(file, "utf8"), "date,amount\n2026-11-01,42");
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["activities.csv"]);
});

test("identical exports leave bytes and modification time untouched", t => {
  const file = destination(t);
  writeVersionedFile(file, "original");
  fs.utimesSync(file, new Date("2000-01-01"), new Date("2000-01-01"));
  const before = fs.statSync(file);
  const result = writeVersionedFile(file, Buffer.from("original"));
  assert.equal(result.status, "unchanged");
  assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs);
  assert.equal(fs.statSync(file).ino, before.ino);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["activities.csv"]);
});

test("archives the exact previous bytes under their hash before replacing the current export", t => {
  const file = destination(t);
  const original = Buffer.from([0x61, 0x0d, 0x0a, 0x62]);
  const first = writeVersionedFile(file, original);
  const result = writeVersionedFile(file, "new format");
  assert.equal(result.status, "updated");
  assert.equal(result.archivePath, path.join(path.dirname(file), `activities.previous-${first.hash}.csv`));
  assert.deepEqual(fs.readFileSync(result.archivePath!), original);
  assert.equal(fs.readFileSync(file, "utf8"), "new format");
  assert.equal(fs.readdirSync(path.dirname(file)).length, 2);
});

test("retains multiple versions and reuses an existing identical archive", t => {
  const file = destination(t);
  writeVersionedFile(file, "A");
  const a = writeVersionedFile(file, "B").archivePath!;
  const b = writeVersionedFile(file, "A").archivePath!;
  writeVersionedFile(file, "B");
  assert.equal(fs.readFileSync(a, "utf8"), "A");
  assert.equal(fs.readFileSync(b, "utf8"), "B");
  assert.equal(fs.readFileSync(file, "utf8"), "B");
  assert.equal(fs.readdirSync(path.dirname(file)).length, 3);
});

test("refuses to overwrite the current file if an existing archive is corrupt", t => {
  const file = destination(t);
  const first = writeVersionedFile(file, "original");
  const archive = path.join(path.dirname(file), `activities.previous-${first.hash}.csv`);
  fs.writeFileSync(archive, "unexpected contents");
  assert.throws(() => writeVersionedFile(file, "new"), /Current export was left untouched/);
  assert.equal(fs.readFileSync(file, "utf8"), "original");
  assert.equal(fs.readFileSync(archive, "utf8"), "unexpected contents");
  assert.equal(fs.readdirSync(path.dirname(file)).length, 2);
});

test("preserves the current export if staging cannot be published", t => {
  const file = destination(t);
  writeVersionedFile(file, "original");
  t.mock.method(fs, "renameSync", () => { throw new Error("rename failed"); });
  assert.throws(() => writeVersionedFile(file, "new"), /rename failed/);
  assert.equal(fs.readFileSync(file, "utf8"), "original");
  const archive = fs.readdirSync(path.dirname(file)).find(name => name.includes(".previous-"));
  assert.ok(archive);
  assert.equal(fs.readFileSync(path.join(path.dirname(file), archive), "utf8"), "original");
});
