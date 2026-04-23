import * as fs from "fs";
import * as path from "path";

export async function statusCommand(_flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  const contextDir = ".ai-context";

  if (!fs.existsSync(contextDir)) {
    console.log("PCP not initialized. Run 'pcp init' to get started.");
    return;
  }

  console.log("=== PCP Status ===\n");

  const bootExists = fs.existsSync(path.join(contextDir, "BOOT.md"));
  const checkpointExists = fs.existsSync(path.join(contextDir, "CHECKPOINT.md"));
  const workingExists = fs.existsSync(path.join(contextDir, "WORKING.md"));
  const indexExists = fs.existsSync(path.join(contextDir, "SESSIONS", "INDEX.md"));

  console.log(`  BOOT.md:       ${bootExists ? "✓" : "✗"}`);
  console.log(`  CHECKPOINT.md: ${checkpointExists ? "✓" : "✗"}`);
  console.log(`  WORKING.md:    ${workingExists ? "✓" : "✗"}`);
  console.log(`  INDEX.md:      ${indexExists ? "✓" : "✗"}`);

  if (checkpointExists) {
    try {
      const content = fs.readFileSync(path.join(contextDir, "CHECKPOINT.md"), "utf-8");
      const statusMatch = content.match(/"status"\s*:\s*"([^"]+)"/);
      const sessionMatch = content.match(/"sessionId"\s*:\s*"([^"]+)"/);
      if (statusMatch) console.log(`\n  Checkpoint status: ${statusMatch[1]}`);
      if (sessionMatch) console.log(`  Session: ${sessionMatch[1]}`);
    } catch {
      // ignore
    }
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

  console.log(`\n  Working sessions: ${workingCount}`);
  console.log(`  Archived sessions: ${archivedCount}`);
}
