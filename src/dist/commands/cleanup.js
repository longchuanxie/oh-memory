"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupCommand = cleanupCommand;
const child_process_1 = require("child_process");
async function cleanupCommand(_flags, _positional) {
    const isWindows = process.platform === "win32";
    const scriptPath = isWindows
        ? ".ai-context/scripts/cleanup.ps1"
        : ".ai-context/scripts/cleanup.sh";
    try {
        if (isWindows) {
            (0, child_process_1.execSync)(`pwsh -ExecutionPolicy Bypass -File "${scriptPath}"`, { stdio: "inherit" });
        }
        else {
            (0, child_process_1.execSync)(`bash "${scriptPath}"`, { stdio: "inherit" });
        }
    }
    catch (err) {
        console.error("Failed to run cleanup script. You can run it manually:");
        console.error(`  ${isWindows ? "pwsh -ExecutionPolicy Bypass -File" : "bash"} ${scriptPath}`);
    }
}
//# sourceMappingURL=cleanup.js.map