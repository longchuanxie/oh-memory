import { execSync } from "child_process";

export async function recoveryCommand(_flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? ".ai-context/scripts/recovery.ps1"
    : ".ai-context/scripts/recovery.sh";

  try {
    if (isWindows) {
      execSync(`pwsh -File "${scriptPath}"`, { stdio: "inherit" });
    } else {
      execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
    }
  } catch (err) {
    console.error("Failed to run recovery script. You can run it manually:");
    console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath}`);
  }
}
