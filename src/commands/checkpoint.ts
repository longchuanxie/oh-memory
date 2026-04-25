import * as fs from "fs";
import * as path from "path";

export interface CheckpointData {
  sessionId: string;
  startTime: string;
  lastUpdate: string;
  status: string;
  currentPhase: string;
  goal: string;
  progress: {
    completed: string[];
    inProgress: string;
    remaining: string[];
  };
  git: {
    branch: string;
    lastCommit: string;
    lastCommitTime: string;
    isClean: boolean;
  };
  files: {
    created: string[];
    modified: string[];
    needsReview: string[];
  };
  channel: string;
}

const CHECKPOINT_PATH = path.join(".ai-context", "CHECKPOINT.json");

export function readCheckpoint(projectDir: string): CheckpointData | null {
  const checkpointPath = path.join(projectDir, CHECKPOINT_PATH);

  const legacyPath = path.join(projectDir, ".ai-context", "CHECKPOINT.md");
  if (!fs.existsSync(checkpointPath) && fs.existsSync(legacyPath)) {
    return readLegacyCheckpoint(legacyPath);
  }

  if (!fs.existsSync(checkpointPath)) return null;

  try {
    const content = fs.readFileSync(checkpointPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readLegacyCheckpoint(filePath: string): CheckpointData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const jsonStr = content.replace(/```json\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function updateCheckpoint(
  projectDir: string,
  updates: Partial<{
    sessionId: string;
    status: string;
    currentPhase: string;
    goal: string;
    completed: string[];
    inProgress: string;
    remaining: string[];
    created: string[];
    modified: string[];
    channel: string;
  }>
): CheckpointData {
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

  const checkpoint: CheckpointData = {
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
  } catch {
    // not a git repo or git not available
  }

  writeCheckpoint(projectDir, checkpoint);
  return checkpoint;
}

export function writeCheckpoint(projectDir: string, checkpoint: CheckpointData): void {
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

export async function checkpointCommand(
  flags: Record<string, string | boolean>,
  positional: string[]
): Promise<void> {
  const projectDir = process.cwd();
  const contextDir = path.join(projectDir, ".ai-context");

  if (!fs.existsSync(contextDir)) {
    console.error("PCP not initialized. Run 'pcp init' first.");
    process.exit(1);
  }

  const completed = (flags.completed as string) || "";
  const remaining = (flags.remaining as string) || "";

  const checkpoint = updateCheckpoint(projectDir, {
    sessionId: (flags.session as string) || undefined,
    status: (flags.status as string) || undefined,
    currentPhase: (flags.phase as string) || undefined,
    goal: (flags.goal as string) || undefined,
    completed: completed ? completed.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    inProgress: (flags.inProgress as string) || undefined,
    remaining: remaining ? remaining.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    created: (flags.created as string) ? (flags.created as string).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    modified: (flags.modified as string) ? (flags.modified as string).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    channel: (flags.channel as string) || undefined,
  });

  console.log("✓ Checkpoint saved");
  console.log(`  Session: ${checkpoint.sessionId}`);
  console.log(`  Phase: ${checkpoint.currentPhase}`);
  console.log(`  Status: ${checkpoint.status}`);
  console.log(`  Completed: ${checkpoint.progress.completed.length} items`);
  console.log(`  Remaining: ${checkpoint.progress.remaining.length} items`);
}
