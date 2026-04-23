import * as fs from "fs";
import { execSync } from "child_process";

export async function importCommand(_flags: Record<string, string | boolean>, positional: string[]): Promise<void> {
  if (positional.length < 1) {
    console.error("Usage: pcp import <archive-file>");
    console.error("  Supported formats: .tar.gz (Unix), .zip (Windows)");
    process.exit(1);
  }

  const archive = positional[0];
  if (!fs.existsSync(archive)) {
    console.error(`Error: Archive not found: ${archive}`);
    process.exit(1);
  }

  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? ".ai-context/scripts/import-context.ps1"
    : ".ai-context/scripts/import-context.sh";

  const forceFlag = _flags.force ? " --force" : isWindows ? " -Force" : " --force";

  try {
    if (isWindows) {
      execSync(`pwsh -File "${scriptPath}" "${archive}"${forceFlag}`, { stdio: "inherit" });
    } else {
      execSync(`bash "${scriptPath}" "${archive}"${forceFlag}`, { stdio: "inherit" });
    }
  } catch (err) {
    console.error("Failed to run import script. You can run it manually:");
    console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath} ${archive}`);
  }
}
