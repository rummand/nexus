// Delete the local SQLite database so the next request re-creates and re-seeds it.
// Stop the dev server first: a running server keeps the old file open and its cached connection.
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
let removed = 0;
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  const file = join(dir, `nexus.db${suffix}`);
  if (existsSync(file)) { rmSync(file); removed++; }
}
console.log(removed ? `Removed ${removed} database file(s) from ${dir}. Start the app to re-seed the demo workspace.` : `No database found in ${dir} — nothing to reset.`);
