"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoveryCommand = recoveryCommand;
const child_process_1 = require("child_process");
async function recoveryCommand(_flags, _positional) {
    const isWindows = process.platform === "win32";
    const scriptPath = isWindows
        ? ".ai-context/scripts/recovery.ps1"
        : ".ai-context/scripts/recovery.sh";
    try {
        if (isWindows) {
            (0, child_process_1.execSync)(`pwsh -File "${scriptPath}"`, { stdio: "inherit" });
        }
        else {
            (0, child_process_1.execSync)(`bash "${scriptPath}"`, { stdio: "inherit" });
        }
    }
    catch (err) {
        console.error("Failed to run recovery script. You can run it manually:");
        console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath}`);
    }
}
//# sourceMappingURL=recovery.js.map