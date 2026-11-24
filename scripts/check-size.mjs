/* eslint-disable no-console */
// Fails if the tracked repo content exceeds the hackathon limit (10 MB), with margin.
import { execSync } from "node:child_process";
import { statSync } from "node:fs";

const LIMIT = 8 * 1024 * 1024;
let files;
try {
  files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  files = execSync("find . -type f -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -not -path './coverage/*'", { encoding: "utf8" })
    .split("\n").filter(Boolean);
}
const total = files.reduce((sum, f) => { try { return sum + statSync(f).size; } catch { return sum; } }, 0);
console.log(`Repo content: ${(total / 1024 / 1024).toFixed(2)} MB (limit ${(LIMIT / 1024 / 1024).toFixed(0)} MB, event cap 10 MB)`);
if (total > LIMIT) { console.error("Repo too large."); process.exit(1); }
