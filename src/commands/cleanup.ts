import { execSync } from "child_process";

export async function cleanupCommand(_flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? ".ai-context/scripts/cleanup.ps1"
    : ".ai-context/scripts/cleanup.sh";

  try {
    if (isWindows) {
      execSync(`pwsh -File "${scriptPath}"`, { stdio: "inherit" });
    } else {
      execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
    }
  } catch (err) {
    console.error("Failed to run cleanup script. You can run it manually:");
    console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath}`);
  }
}
