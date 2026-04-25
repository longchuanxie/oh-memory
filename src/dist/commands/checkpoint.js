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
exports.readCheckpoint = readCheckpoint;
exports.updateCheckpoint = updateCheckpoint;
exports.writeCheckpoint = writeCheckpoint;
exports.checkpointCommand = checkpointCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CHECKPOINT_PATH = path.join(".ai-context", "CHECKPOINT.json");
function readCheckpoint(projectDir) {
    const checkpointPath = path.join(projectDir, CHECKPOINT_PATH);
    const legacyPath = path.join(projectDir, ".ai-context", "CHECKPOINT.md");
    if (!fs.existsSync(checkpointPath) && fs.existsSync(legacyPath)) {
        return readLegacyCheckpoint(legacyPath);
    }
    if (!fs.existsSync(checkpointPath))
        return null;
    try {
        const content = fs.readFileSync(checkpointPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
function readLegacyCheckpoint(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const jsonStr = content.replace(/```json\n?/, "").replace(/\n?```$/, "");
        return JSON.parse(jsonStr);
    }
    catch {
        return null;
    }
}
function updateCheckpoint(projectDir, updates) {
    const existing = readCheckpoint(projectDir) || {
        sessionId: "unknown",
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        status: "in-progress",
        currentPhase: "",
        goal: "",
        progress: { completed: [], inProgress: "", remaining: [] },
        git: { branch: "unknown", lastCommit: "", lastCommitTime: "", isClean: true },
        files: { created: [], modified: [], needsReview: [] },
        channel: "main",
    };
    const checkpoint = {
        sessionId: updates.sessionId || existing.sessionId,
        startTime: existing.startTime,
        lastUpdate: new Date().toISOString(),
        status: updates.status || existing.status,
        currentPhase: updates.currentPhase || existing.currentPhase,
        goal: updates.goal || existing.goal,
        progress: {
            completed: updates.completed || existing.progress.completed,
            inProgress: updates.inProgress !== undefined ? updates.inProgress : existing.progress.inProgress,
            remaining: updates.remaining || existing.progress.remaining,
        },
        git: existing.git,
        files: {
            created: updates.created || existing.files.created,
            modified: updates.modified || existing.files.modified,
            needsReview: existing.files.needsReview,
        },
        channel: updates.channel || existing.channel,
    };
    try {
        const { execSync } = require("child_process");
        checkpoint.git.branch =
            execSync("git branch --show-current", { cwd: projectDir, encoding: "utf-8" }).trim() ||
                checkpoint.git.branch;
        const lastCommit = execSync("git log -1 --oneline", { cwd: projectDir, encoding: "utf-8" }).trim();
        if (lastCommit) {
            checkpoint.git.lastCommit = lastCommit;
            checkpoint.git.lastCommitTime = new Date().toISOString();
        }
        const gitStatus = execSync("git status --porcelain", { cwd: projectDir, encoding: "utf-8" }).trim();
        checkpoint.git.isClean = !gitStatus;
    }
    catch {
        // not a git repo or git not available
    }
    writeCheckpoint(projectDir, checkpoint);
    return checkpoint;
}
function writeCheckpoint(projectDir, checkpoint) {
    const checkpointPath = path.join(projectDir, CHECKPOINT_PATH);
    const contextDir = path.dirname(checkpointPath);
    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }
    const tmpPath = checkpointPath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(checkpoint, null, 2) + "\n", "utf-8");
    fs.renameSync(tmpPath, checkpointPath);
    const legacyPath = path.join(projectDir, ".ai-context", "CHECKPOINT.md");
    if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
    }
}
async function checkpointCommand(flags, positional) {
    const projectDir = process.cwd();
    const contextDir = path.join(projectDir, ".ai-context");
    if (!fs.existsSync(contextDir)) {
        console.error("PCP not initialized. Run 'pcp init' first.");
        process.exit(1);
    }
    const completed = flags.completed || "";
    const remaining = flags.remaining || "";
    const checkpoint = updateCheckpoint(projectDir, {
        sessionId: flags.session || undefined,
        status: flags.status || undefined,
        currentPhase: flags.phase || undefined,
        goal: flags.goal || undefined,
        completed: completed ? completed.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        inProgress: flags.inProgress || undefined,
        remaining: remaining ? remaining.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        created: flags.created ? flags.created.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        modified: flags.modified ? flags.modified.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        channel: flags.channel || undefined,
    });
    console.log("✓ Checkpoint saved");
    console.log(`  Session: ${checkpoint.sessionId}`);
    console.log(`  Phase: ${checkpoint.currentPhase}`);
    console.log(`  Status: ${checkpoint.status}`);
    console.log(`  Completed: ${checkpoint.progress.completed.length} items`);
    console.log(`  Remaining: ${checkpoint.progress.remaining.length} items`);
}
//# sourceMappingURL=checkpoint.js.map