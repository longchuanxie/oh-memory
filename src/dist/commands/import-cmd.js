"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
async function importCommand(_flags, positional) {
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
            (0, child_process_1.execSync)(`pwsh -File "${scriptPath}" "${archive}"${forceFlag}`, { stdio: "inherit" });
        }
        else {
            (0, child_process_1.execSync)(`bash "${scriptPath}" "${archive}"${forceFlag}`, { stdio: "inherit" });
        }
    }
    catch (err) {
        console.error("Failed to run import script. You can run it manually:");
        console.error(`  ${isWindows ? "pwsh" : "bash"} ${scriptPath} ${archive}`);
    }
}
//# sourceMappingURL=import-cmd.js.map