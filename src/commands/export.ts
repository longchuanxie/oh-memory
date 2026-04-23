import * as fs from "fs";
import { execSync } from "child_process";

export async function exportCommand(_flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  if (!fs.existsSync(".ai-context")) {
    console.error("Error: .ai-context/ not found. Run 'pcp init' first.");
    process.exit(1);
  }

  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? ".ai-context/scripts/export-context.ps1"
    : ".ai-context/scripts/export-context.sh";

  try {
    if (isWindows) {
      execSync(`pwsh -File "${scriptPath}"`, { stdio: "inherit" });
    } else {
      execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
    }
  } catch (err) {
    console.error("Failed to run export script. You can run it manually:");
    console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath}`);
  }
}
