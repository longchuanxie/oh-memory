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
exports.ensureContextDirs = ensureContextDirs;
exports.generateSessionId = generateSessionId;
exports.getBranch = getBranch;
exports.sessionFilePath = sessionFilePath;
exports.createSession = createSession;
exports.renderSessionFile = renderSessionFile;
exports.parseSessionFile = parseSessionFile;
exports.listWorkingSessions = listWorkingSessions;
exports.listArchivedSessions = listArchivedSessions;
exports.endSession = endSession;
exports.archiveSession = archiveSession;
exports.searchSessions = searchSessions;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONTEXT_DIR = ".ai-context";
const WORKING_DIR = path.join(CONTEXT_DIR, "SESSIONS", "WORKING");
const ARCHIVED_DIR = path.join(CONTEXT_DIR, "SESSIONS", "ARCHIVED");
function ensureContextDirs(projectDir) {
    const dirs = [WORKING_DIR, ARCHIVED_DIR];
    for (const dir of dirs) {
        const fullPath = path.join(projectDir, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }
}
function generateSessionId(topic) {
    const date = new Date().toISOString().split("T")[0];
    const slug = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
    return `${date}-${slug}`;
}
function getBranch(projectDir) {
    try {
        const { execSync } = require("child_process");
        const branch = execSync("git branch --show-current", {
            cwd: projectDir,
            encoding: "utf-8",
        }).trim();
        return branch || "main";
    }
    catch {
        return "main";
    }
}
function sessionFilePath(projectDir, sessionId, status) {
    const dir = status === "archived" ? ARCHIVED_DIR : WORKING_DIR;
    return path.join(projectDir, dir, `${sessionId}.md`);
}
function createSession(projectDir, topic, goal) {
    ensureContextDirs(projectDir);
    const sessionId = generateSessionId(topic);
    const date = new Date().toISOString().split("T")[0];
    const channel = getBranch(projectDir);
    const session = {
        meta: {
            sessionId,
            date,
            channel,
            status: "in-progress",
            topic,
            goal,
        },
        summary: "",
        progress: {
            current: goal,
            completed: [],
            remaining: [],
        },
        changes: {
            created: [],
            modified: [],
        },
        insights: [],
        keyDecisions: [],
        nextSteps: [],
        detailedLog: "",
    };
    const filePath = sessionFilePath(projectDir, sessionId, "working");
    fs.writeFileSync(filePath, renderSessionFile(session), "utf-8");
    return session;
}
function renderSessionFile(session) {
    const lines = [];
    lines.push("---");
    lines.push(`sessionId: ${session.meta.sessionId}`);
    lines.push(`date: ${session.meta.date}`);
    lines.push(`channel: ${session.meta.channel}`);
    lines.push(`status: ${session.meta.status}`);
    lines.push("---");
    lines.push("");
    lines.push(`# Session: ${session.meta.topic}`);
    lines.push("");
    lines.push("## Summary");
    lines.push(session.summary || "(to be filled)");
    lines.push("");
    lines.push("## Goal");
    lines.push(session.meta.goal);
    lines.push("");
    lines.push("## Progress");
    lines.push(`- Current: ${session.progress.current}`);
    lines.push(`- Completed: ${session.progress.completed.length > 0 ? session.progress.completed.join(", ") : "(none)"}`);
    lines.push(`- Remaining: ${session.progress.remaining.length > 0 ? session.progress.remaining.join(", ") : "(none)"}`);
    lines.push("");
    lines.push("## Changes");
    lines.push("### Created");
    session.changes.created.forEach((c) => lines.push(`- ${c}`));
    if (session.changes.created.length === 0)
        lines.push("- (none)");
    lines.push("### Modified");
    session.changes.modified.forEach((c) => lines.push(`- ${c}`));
    if (session.changes.modified.length === 0)
        lines.push("- (none)");
    lines.push("");
    lines.push("## Key Decisions");
    session.keyDecisions.forEach((d) => lines.push(`- ${d}`));
    if (session.keyDecisions.length === 0)
        lines.push("- (none yet)");
    lines.push("");
    lines.push("## Insights");
    session.insights.forEach((i) => lines.push(`- ${i}`));
    if (session.insights.length === 0)
        lines.push("- (none yet)");
    lines.push("");
    lines.push("## Next Steps");
    session.nextSteps.forEach((n) => lines.push(`- ${n}`));
    if (session.nextSteps.length === 0)
        lines.push("- (to be determined)");
    lines.push("");
    lines.push("## Detailed Log (Ephemeral)");
    lines.push(session.detailedLog || "(debug details, removed during archiving)");
    return lines.join("\n");
}
function parseSessionFile(content) {
    const meta = {
        sessionId: "",
        date: "",
        channel: "main",
        status: "in-progress",
        topic: "",
        goal: "",
    };
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const sessionIdMatch = fm.match(/sessionId:\s*(.+)/);
        if (sessionIdMatch)
            meta.sessionId = sessionIdMatch[1].trim();
        const dateMatch = fm.match(/date:\s*(.+)/);
        if (dateMatch)
            meta.date = dateMatch[1].trim();
        const channelMatch = fm.match(/channel:\s*(.+)/);
        if (channelMatch)
            meta.channel = channelMatch[1].trim();
        const statusMatch = fm.match(/status:\s*(.+)/);
        if (statusMatch)
            meta.status = statusMatch[1].trim();
    }
    const topicMatch = content.match(/^# Session:\s*(.+)$/m);
    if (topicMatch)
        meta.topic = topicMatch[1].trim();
    const goalMatch = content.match(/^## Goal\s*\n+(.+?)(?=\n##|\n$)/m);
    if (goalMatch)
        meta.goal = goalMatch[1].trim();
    const summaryMatch = content.match(/^## Summary\s*\n+(.+?)(?=\n##|\n$)/m);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const progressCompleted = extractListSection(content, "Progress", "Completed");
    const progressRemaining = extractListSection(content, "Progress", "Remaining");
    const created = extractListSection(content, "Changes", "Created");
    const modified = extractListSection(content, "Changes", "Modified");
    const keyDecisions = extractListSection(content, "Key Decisions");
    const insights = extractListSection(content, "Insights");
    const nextSteps = extractListSection(content, "Next Steps");
    return {
        meta,
        summary,
        progress: {
            current: meta.goal,
            completed: progressCompleted,
            remaining: progressRemaining,
        },
        changes: { created, modified },
        insights,
        keyDecisions,
        nextSteps,
        detailedLog: "",
    };
}
function extractListSection(content, ...headers) {
    const headerPattern = headers.map((h) => `## ${h}`).join("[\\s\\S]*?");
    const regex = new RegExp(`${headerPattern}[\\s\\S]*?\\n((?:- .+\\n?)*)`, "m");
    const match = content.match(regex);
    if (!match)
        return [];
    return match[1]
        .split("\n")
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter((l) => l && l !== "(none)" && l !== "(none yet)" && l !== "(to be determined)");
}
function listWorkingSessions(projectDir) {
    const workingPath = path.join(projectDir, WORKING_DIR);
    return listSessionsInDir(workingPath);
}
function listArchivedSessions(projectDir) {
    const archivedPath = path.join(projectDir, ARCHIVED_DIR);
    return listSessionsInDir(archivedPath);
}
function listSessionsInDir(dirPath) {
    if (!fs.existsSync(dirPath))
        return [];
    const sessions = [];
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
            const session = parseSessionFile(content);
            sessions.push(session.meta);
        }
        catch {
            // skip malformed files
        }
    }
    return sessions.sort((a, b) => b.date.localeCompare(a.date));
}
function endSession(projectDir, sessionId) {
    const workingPath = path.join(projectDir, WORKING_DIR, `${sessionId}.md`);
    if (!fs.existsSync(workingPath)) {
        console.error(`Session not found: ${sessionId}`);
        return false;
    }
    const content = fs.readFileSync(workingPath, "utf-8");
    const updated = content
        .replace(/status:\s*\w+/, "status: completed")
        .replace(/## Detailed Log \(Ephemeral\)[\s\S]*?(?=\n## |\n*$)/, "## Detailed Log (Ephemeral)\n(removed during completion)");
    fs.writeFileSync(workingPath, updated.trim() + "\n", "utf-8");
    return true;
}
function archiveSession(projectDir, sessionId) {
    const workingPath = path.join(projectDir, WORKING_DIR, `${sessionId}.md`);
    const archivedPath = path.join(projectDir, ARCHIVED_DIR, `${sessionId}.md`);
    if (!fs.existsSync(workingPath)) {
        if (fs.existsSync(archivedPath)) {
            console.log(`Session already archived: ${sessionId}`);
            return true;
        }
        console.error(`Session not found: ${sessionId}`);
        return false;
    }
    const content = fs.readFileSync(workingPath, "utf-8");
    const session = parseSessionFile(content);
    const archived = renderArchivedSession(session);
    fs.writeFileSync(archivedPath, archived, "utf-8");
    fs.unlinkSync(workingPath);
    return true;
}
function renderArchivedSession(session) {
    const lines = [];
    lines.push("---");
    lines.push(`sessionId: ${session.meta.sessionId}`);
    lines.push(`date: ${session.meta.date}`);
    lines.push(`channel: ${session.meta.channel}`);
    lines.push(`status: archived`);
    lines.push("---");
    lines.push("");
    lines.push(`# Session: ${session.meta.topic}`);
    lines.push("");
    lines.push("## Summary");
    lines.push(session.summary || "(no summary)");
    lines.push("");
    lines.push("## Goal");
    lines.push(session.meta.goal);
    lines.push("");
    lines.push("## Key Decisions");
    session.keyDecisions.forEach((d) => lines.push(`- ${d}`));
    if (session.keyDecisions.length === 0)
        lines.push("- (none)");
    lines.push("");
    lines.push("## Insights");
    session.insights.forEach((i) => lines.push(`- ${i}`));
    if (session.insights.length === 0)
        lines.push("- (none)");
    lines.push("");
    lines.push("## Changes Summary");
    lines.push(`- Created: ${session.changes.created.length} files`);
    lines.push(`- Modified: ${session.changes.modified.length} files`);
    lines.push("");
    return lines.join("\n");
}
function searchSessions(projectDir, query) {
    const allSessions = [
        ...listWorkingSessions(projectDir),
        ...listArchivedSessions(projectDir),
    ];
    const lowerQuery = query.toLowerCase();
    return allSessions.filter((s) => s.topic.toLowerCase().includes(lowerQuery) ||
        s.goal.toLowerCase().includes(lowerQuery) ||
        s.sessionId.toLowerCase().includes(lowerQuery) ||
        s.channel.toLowerCase().includes(lowerQuery));
}
//# sourceMappingURL=session-manager.js.map