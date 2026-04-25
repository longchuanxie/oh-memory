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
exports.checkRecovery = checkRecovery;
exports.recoveryCommand = recoveryCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const checkpoint_1 = require("./checkpoint");
const CONTEXT_DIR = ".ai-context";
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
function checkRecovery(projectDir) {
    const result = {
        hasPCP: fs.existsSync(path.join(projectDir, CONTEXT_DIR)),
        hasCheckpoint: false,
        isStale: false,
        staleHours: 0,
        checkpoint: null,
        gitStatus: {
            branch: "unknown",
            isClean: true,
            modifiedFiles: [],
            untrackedFiles: [],
            lastCommit: "",
        },
        recommendation: "",
    };
    if (!result.hasPCP) {
        result.recommendation = "PCP not initialized. Run 'pcp init' first.";
        return result;
    }
    const checkpoint = (0, checkpoint_1.readCheckpoint)(projectDir);
    if (!checkpoint) {
        result.recommendation = "No checkpoint found. Start a new session with 'pcp session start <topic>'.";
        return result;
    }
    result.hasCheckpoint = true;
    result.checkpoint = checkpoint;
    if (checkpoint.status === "in-progress") {
        const lastUpdate = new Date(checkpoint.lastUpdate).getTime();
        const now = Date.now();
        const diffMs = now - lastUpdate;
        result.staleHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        result.isStale = diffMs > STALE_THRESHOLD_MS;
    }
    try {
        const { execSync } = require("child_process");
        result.gitStatus.branch =
            execSync("git branch --show-current", { cwd: projectDir, encoding: "utf-8" }).trim() ||
                "unknown";
        result.gitStatus.lastCommit = execSync("git log -1 --oneline", {
            cwd: projectDir,
            encoding: "utf-8",
        }).trim();
        const statusOutput = execSync("git status --porcelain", {
            cwd: projectDir,
            encoding: "utf-8",
        }).trim();
        if (statusOutput) {
            result.gitStatus.isClean = false;
            const lines = statusOutput.split("\n");
            for (const line of lines) {
                const filePath = line.slice(3);
                const statusCode = line.slice(0, 2);
                if (statusCode.includes("?")) {
                    result.gitStatus.untrackedFiles.push(filePath);
                }
                else {
                    result.gitStatus.modifiedFiles.push(filePath);
                }
            }
        }
    }
    catch {
        // not a git repo
    }
    if (result.isStale) {
        result.recommendation = `Session "${checkpoint.sessionId}" appears to have terminated abnormally (stale for ${result.staleHours}h). Consider recovery options.`;
    }
    else if (checkpoint.status === "in-progress") {
        result.recommendation = `Session "${checkpoint.sessionId}" is in progress and recent. You may continue working.`;
    }
    else {
        result.recommendation = "No recovery needed. Last session completed normally.";
    }
    return result;
}
async function recoveryCommand(flags, _positional) {
    const projectDir = process.cwd();
    const status = checkRecovery(projectDir);
    if (!status.hasPCP) {
        console.error("PCP not initialized. Run 'pcp init' first.");
        return;
    }
    const jsonOutput = !!flags.json;
    if (jsonOutput) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }
    console.log("=== PCP Recovery Check ===\n");
    if (!status.hasCheckpoint) {
        console.log("  No checkpoint found.");
        console.log(`  ${status.recommendation}`);
        return;
    }
    console.log(`  Session: ${status.checkpoint.sessionId}`);
    console.log(`  Status: ${status.checkpoint.status}`);
    console.log(`  Phase: ${status.checkpoint.currentPhase}`);
    console.log(`  Last Update: ${status.checkpoint.lastUpdate}`);
    console.log(`  Stale: ${status.isStale ? `Yes (${status.staleHours}h ago)` : "No"}`);
    console.log("");
    console.log("  Git State:");
    console.log(`    Branch: ${status.gitStatus.branch}`);
    console.log(`    Clean: ${status.gitStatus.isClean ? "Yes" : "No"}`);
    console.log(`    Last Commit: ${status.gitStatus.lastCommit || "(none)"}`);
    if (!status.gitStatus.isClean) {
        console.log(`    Modified Files: ${status.gitStatus.modifiedFiles.length}`);
        for (const f of status.gitStatus.modifiedFiles.slice(0, 10)) {
            console.log(`      - ${f}`);
        }
        if (status.gitStatus.modifiedFiles.length > 10) {
            console.log(`      ... and ${status.gitStatus.modifiedFiles.length - 10} more`);
        }
        console.log(`    Untracked Files: ${status.gitStatus.untrackedFiles.length}`);
        for (const f of status.gitStatus.untrackedFiles.slice(0, 5)) {
            console.log(`      - ${f}`);
        }
        if (status.gitStatus.untrackedFiles.length > 5) {
            console.log(`      ... and ${status.gitStatus.untrackedFiles.length - 5} more`);
        }
    }
    console.log("");
    console.log(`  Recommendation: ${status.recommendation}`);
    if (status.isStale) {
        console.log("");
        console.log("  Recovery Options:");
        console.log("    1. Continue  — Resume from checkpoint state");
        console.log("    2. Review    — Show git diff before deciding");
        console.log("    3. Discard   — Revert uncommitted changes (git checkout . + git clean -fd)");
        console.log("    4. New Task  — Stash changes (git stash) and start fresh");
        console.log("");
        console.log("  To start a new session after recovery:");
        console.log("    pcp session start <topic>");
    }
}
//# sourceMappingURL=recovery.js.map