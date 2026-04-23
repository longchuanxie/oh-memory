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
exports.statusCommand = statusCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function statusCommand(_flags, _positional) {
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
            if (statusMatch)
                console.log(`\n  Checkpoint status: ${statusMatch[1]}`);
            if (sessionMatch)
                console.log(`  Session: ${sessionMatch[1]}`);
        }
        catch {
            // ignore
        }
    }
    const workingDir = path.join(contextDir, "SESSIONS", "WORKING");
    const archivedDir = path.join(contextDir, "SESSIONS", "ARCHIVED");
    let workingCount = 0;
    let archivedCount = 0;
    try {
        workingCount = fs.readdirSync(workingDir).filter((f) => f.endsWith(".md")).length;
    }
    catch { /* empty */ }
    try {
        archivedCount = fs.readdirSync(archivedDir).filter((f) => f.endsWith(".md")).length;
    }
    catch { /* empty */ }
    console.log(`\n  Working sessions: ${workingCount}`);
    console.log(`  Archived sessions: ${archivedCount}`);
}
//# sourceMappingURL=status.js.map