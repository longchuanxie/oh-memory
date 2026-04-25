import * as fs from "fs";
import * as path from "path";
import { readCheckpoint } from "./checkpoint";

export async function statusCommand(_flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  const contextDir = ".ai-context";

  if (!fs.existsSync(contextDir)) {
    console.log("PCP not initialized. Run 'pcp init' to get started.");
    return;
  }

  console.log("=== PCP Status ===\n");

  const bootExists = fs.existsSync(path.join(contextDir, "BOOT.md"));
  const checkpointJsonExists = fs.existsSync(path.join(contextDir, "CHECKPOINT.json"));
  const checkpointMdExists = fs.existsSync(path.join(contextDir, "CHECKPOINT.md"));
  const workingExists = fs.existsSync(path.join(contextDir, "WORKING.md"));
  const indexExists = fs.existsSync(path.join(contextDir, "SESSIONS", "INDEX.md"));
  const projectExists = fs.existsSync(path.join(contextDir, "PROJECT.md"));
  const architectureExists = fs.existsSync(path.join(contextDir, "ARCHITECTURE.md"));
  const decisionsExists = fs.existsSync(path.join(contextDir, "DECISIONS.md"));
  const patternsExists = fs.existsSync(path.join(contextDir, "PATTERNS.md"));
  const glossaryExists = fs.existsSync(path.join(contextDir, "GLOSSARY.md"));

  console.log("  Core Files:");
  console.log(`    BOOT.md:          ${bootExists ? "✓" : "✗"}`);
  console.log(`    PROJECT.md:       ${projectExists ? "✓" : "✗"}`);
  console.log(`    WORKING.md:       ${workingExists ? "✓" : "✗"}`);
  console.log(`    CHECKPOINT.json:  ${checkpointJsonExists ? "✓" : "✗"}`);
  if (checkpointMdExists && !checkpointJsonExists) {
    console.log(`    CHECKPOINT.md:    ⚠ (legacy format, will be migrated on next checkpoint)`);
  }

  console.log("\n  Knowledge Files:");
  console.log(`    ARCHITECTURE.md:  ${architectureExists ? "✓" : "✗"}`);
  console.log(`    DECISIONS.md:     ${decisionsExists ? "✓" : "✗"}`);
  console.log(`    PATTERNS.md:      ${patternsExists ? "✓" : "✗"}`);
  console.log(`    GLOSSARY.md:      ${glossaryExists ? "✓" : "✗"}`);

  console.log("\n  Session Index:");
  console.log(`    INDEX.md:         ${indexExists ? "✓" : "✗"}`);

  const checkpoint = readCheckpoint(process.cwd());
  if (checkpoint) {
    console.log("\n  Current Checkpoint:");
    console.log(`    Session:  ${checkpoint.sessionId}`);
    console.log(`    Status:   ${checkpoint.status}`);
    console.log(`    Phase:    ${checkpoint.currentPhase || "(none)"}`);
    console.log(`    Channel:  ${checkpoint.channel}`);
    console.log(`    Updated:  ${checkpoint.lastUpdate}`);
    console.log(`    Completed: ${checkpoint.progress.completed.length} items`);
    console.log(`    Remaining: ${checkpoint.progress.remaining.length} items`);
  }

  const workingDir = path.join(contextDir, "SESSIONS", "WORKING");
  const archivedDir = path.join(contextDir, "SESSIONS", "ARCHIVED");
  let workingCount = 0;
  let archivedCount = 0;

  try {
    workingCount = fs.readdirSync(workingDir).filter((f) => f.endsWith(".md")).length;
  } catch { /* empty */ }
  try {
    archivedCount = fs.readdirSync(archivedDir).filter((f) => f.endsWith(".md")).length;
  } catch { /* empty */ }

  console.log("\n  Sessions:");
  console.log(`    Working:  ${workingCount}`);
  console.log(`    Archived: ${archivedCount}`);
}
