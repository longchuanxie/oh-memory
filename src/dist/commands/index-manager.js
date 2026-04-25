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
exports.readIndex = readIndex;
exports.addActiveSession = addActiveSession;
exports.moveSessionToArchived = moveSessionToArchived;
exports.removeSessionFromIndex = removeSessionFromIndex;
exports.writeIndex = writeIndex;
exports.sessionMetaToIndexEntry = sessionMetaToIndexEntry;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const INDEX_PATH = path.join(".ai-context", "SESSIONS", "INDEX.md");
function readIndex(projectDir) {
    const indexPath = path.join(projectDir, INDEX_PATH);
    if (!fs.existsSync(indexPath)) {
        return { active: [], archived: [], byTopic: {}, byChannel: {} };
    }
    const content = fs.readFileSync(indexPath, "utf-8");
    const active = parseTableSection(content, "Active Sessions");
    const archived = parseTableSection(content, "Recent Archives");
    const byTopic = {};
    const byChannel = {};
    for (const entry of [...active, ...archived]) {
        const topicKey = entry.topic.toLowerCase();
        if (!byTopic[topicKey])
            byTopic[topicKey] = [];
        byTopic[topicKey].push(entry);
        const channelKey = entry.channel || "main";
        if (!byChannel[channelKey])
            byChannel[channelKey] = [];
        byChannel[channelKey].push(entry);
    }
    return { active, archived, byTopic, byChannel };
}
function parseTableSection(content, sectionHeader) {
    const entries = [];
    const regex = new RegExp(`## ${escapeRegex(sectionHeader)}[^#]*`, "m");
    const sectionMatch = content.match(regex);
    if (!sectionMatch)
        return entries;
    const sectionStart = (sectionMatch.index || 0) + sectionMatch[0].length;
    const nextSection = content.indexOf("## ", sectionStart);
    const sectionContent = content.slice(sectionStart, nextSection === -1 ? undefined : nextSection);
    const tableRows = sectionContent.match(/^\|(.+)\|$/gm);
    if (!tableRows || tableRows.length < 2)
        return entries;
    for (let i = 2; i < tableRows.length; i++) {
        const cells = tableRows[i]
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c);
        if (cells.length >= 4 && cells[0] !== "*(none yet)*" && cells[0] !== "") {
            entries.push({
                date: cells[0] || "",
                topic: cells[1] || "",
                goal: cells[2] || "",
                status: cells[3] || "",
                file: cells[4] || "",
                keyDecisions: cells[3] || "",
            });
        }
    }
    return entries;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function addActiveSession(projectDir, entry) {
    const index = readIndex(projectDir);
    const existing = index.active.find((e) => e.file === entry.file || (e.date === entry.date && e.topic === entry.topic));
    if (existing)
        return;
    index.active.push(entry);
    writeIndex(projectDir, index);
}
function moveSessionToArchived(projectDir, sessionId) {
    const index = readIndex(projectDir);
    const entryIndex = index.active.findIndex((e) => e.file === `${sessionId}.md`);
    if (entryIndex === -1)
        return;
    const entry = index.active.splice(entryIndex, 1)[0];
    entry.status = "archived";
    index.archived.unshift(entry);
    if (index.archived.length > 30) {
        index.archived = index.archived.slice(0, 30);
    }
    writeIndex(projectDir, index);
}
function removeSessionFromIndex(projectDir, sessionId) {
    const index = readIndex(projectDir);
    index.active = index.active.filter((e) => e.file !== `${sessionId}.md`);
    index.archived = index.archived.filter((e) => e.file !== `${sessionId}.md`);
    writeIndex(projectDir, index);
}
function writeIndex(projectDir, index) {
    const indexPath = path.join(projectDir, INDEX_PATH);
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const branch = getBranchFromIndex(index);
    const lines = [];
    lines.push("# SESSIONS INDEX");
    lines.push("");
    lines.push("## Active Sessions");
    lines.push("| Date | Topic | Goal | Status | File |");
    lines.push("|------|-------|------|--------|------|");
    if (index.active.length === 0) {
        lines.push("| *(none)* | | | | |");
    }
    else {
        for (const e of index.active) {
            lines.push(`| ${e.date} | ${e.topic} | ${e.goal} | ${e.status} | ${e.file} |`);
        }
    }
    lines.push("");
    lines.push("## Recent Archives (Last 30 Days)");
    lines.push("| Date | Topic | Key Decisions | File |");
    lines.push("|------|-------|---------------|------|");
    if (index.archived.length === 0) {
        lines.push("| *(none)* | | | |");
    }
    else {
        for (const e of index.archived) {
            lines.push(`| ${e.date} | ${e.topic} | ${e.keyDecisions || "-"} | ${e.file} |`);
        }
    }
    lines.push("");
    lines.push("## By Topic");
    const byTopic = index.byTopic || buildByTopic(index);
    const topicKeys = Object.keys(byTopic);
    if (topicKeys.length === 0) {
        lines.push("*(no sessions yet)*");
    }
    else {
        for (const topic of topicKeys) {
            lines.push(`### ${topic}`);
            for (const e of byTopic[topic]) {
                lines.push(`- ${e.date}: ${e.status} — ${e.file}`);
            }
        }
    }
    lines.push("");
    lines.push("## By Channel");
    const byChannel = index.byChannel || buildByChannel(index);
    const channelKeys = Object.keys(byChannel);
    if (channelKeys.length === 0) {
        lines.push(`### ${branch}`);
        lines.push("*(no sessions yet)*");
    }
    else {
        for (const ch of channelKeys) {
            lines.push(`### ${ch}`);
            const chSessions = byChannel[ch];
            if (chSessions.length === 0) {
                lines.push("*(no sessions yet)*");
            }
            else {
                for (const e of chSessions) {
                    lines.push(`- ${e.date}: ${e.topic} (${e.status}) — ${e.file}`);
                }
            }
        }
    }
    lines.push("");
    fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
}
function getBranchFromIndex(index) {
    const allEntries = [...index.active, ...index.archived];
    for (const e of allEntries) {
        if (e.channel)
            return e.channel;
    }
    return "main";
}
function buildByTopic(index) {
    const byTopic = {};
    for (const e of [...index.active, ...index.archived]) {
        const key = e.topic.toLowerCase();
        if (!byTopic[key])
            byTopic[key] = [];
        byTopic[key].push(e);
    }
    return byTopic;
}
function buildByChannel(index) {
    const byChannel = {};
    for (const e of [...index.active, ...index.archived]) {
        const key = e.channel || "main";
        if (!byChannel[key])
            byChannel[key] = [];
        byChannel[key].push(e);
    }
    return byChannel;
}
function sessionMetaToIndexEntry(meta) {
    return {
        date: meta.date,
        topic: meta.topic,
        goal: meta.goal,
        status: meta.status,
        file: `${meta.sessionId}.md`,
        channel: meta.channel,
    };
}
//# sourceMappingURL=index-manager.js.map