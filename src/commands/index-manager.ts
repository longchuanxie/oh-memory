import * as fs from "fs";
import * as path from "path";
import { SessionMeta } from "./session-manager";

const INDEX_PATH = path.join(".ai-context", "SESSIONS", "INDEX.md");

export interface IndexEntry {
  date: string;
  topic: string;
  goal: string;
  status: string;
  file: string;
  keyDecisions?: string;
  channel?: string;
}

export function readIndex(projectDir: string): {
  active: IndexEntry[];
  archived: IndexEntry[];
  byTopic: Record<string, IndexEntry[]>;
  byChannel: Record<string, IndexEntry[]>;
} {
  const indexPath = path.join(projectDir, INDEX_PATH);
  if (!fs.existsSync(indexPath)) {
    return { active: [], archived: [], byTopic: {}, byChannel: {} };
  }

  const content = fs.readFileSync(indexPath, "utf-8");
  const active = parseTableSection(content, "Active Sessions");
  const archived = parseTableSection(content, "Recent Archives");

  const byTopic: Record<string, IndexEntry[]> = {};
  const byChannel: Record<string, IndexEntry[]> = {};

  for (const entry of [...active, ...archived]) {
    const topicKey = entry.topic.toLowerCase();
    if (!byTopic[topicKey]) byTopic[topicKey] = [];
    byTopic[topicKey].push(entry);

    const channelKey = entry.channel || "main";
    if (!byChannel[channelKey]) byChannel[channelKey] = [];
    byChannel[channelKey].push(entry);
  }

  return { active, archived, byTopic, byChannel };
}

function parseTableSection(content: string, sectionHeader: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const regex = new RegExp(`## ${escapeRegex(sectionHeader)}[^#]*`, "m");
  const sectionMatch = content.match(regex);

  if (!sectionMatch) return entries;

  const sectionStart = (sectionMatch.index || 0) + sectionMatch[0].length;
  const nextSection = content.indexOf("## ", sectionStart);
  const sectionContent = content.slice(
    sectionStart,
    nextSection === -1 ? undefined : nextSection
  );

  const tableRows = sectionContent.match(/^\|(.+)\|$/gm);
  if (!tableRows || tableRows.length < 2) return entries;

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function addActiveSession(projectDir: string, entry: IndexEntry): void {
  const index = readIndex(projectDir);
  const existing = index.active.find(
    (e) => e.file === entry.file || (e.date === entry.date && e.topic === entry.topic)
  );
  if (existing) return;

  index.active.push(entry);
  writeIndex(projectDir, index);
}

export function moveSessionToArchived(projectDir: string, sessionId: string): void {
  const index = readIndex(projectDir);
  const entryIndex = index.active.findIndex((e) => e.file === `${sessionId}.md`);
  if (entryIndex === -1) return;

  const entry = index.active.splice(entryIndex, 1)[0];
  entry.status = "archived";
  index.archived.unshift(entry);

  if (index.archived.length > 30) {
    index.archived = index.archived.slice(0, 30);
  }

  writeIndex(projectDir, index);
}

export function removeSessionFromIndex(projectDir: string, sessionId: string): void {
  const index = readIndex(projectDir);
  index.active = index.active.filter((e) => e.file !== `${sessionId}.md`);
  index.archived = index.archived.filter((e) => e.file !== `${sessionId}.md`);
  writeIndex(projectDir, index);
}

export function writeIndex(
  projectDir: string,
  index: {
    active: IndexEntry[];
    archived: IndexEntry[];
    byTopic?: Record<string, IndexEntry[]>;
    byChannel?: Record<string, IndexEntry[]>;
  }
): void {
  const indexPath = path.join(projectDir, INDEX_PATH);
  const dir = path.dirname(indexPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const branch = getBranchFromIndex(index);

  const lines: string[] = [];
  lines.push("# SESSIONS INDEX");
  lines.push("");
  lines.push("## Active Sessions");
  lines.push("| Date | Topic | Goal | Status | File |");
  lines.push("|------|-------|------|--------|------|");

  if (index.active.length === 0) {
    lines.push("| *(none)* | | | | |");
  } else {
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
  } else {
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
  } else {
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
  } else {
    for (const ch of channelKeys) {
      lines.push(`### ${ch}`);
      const chSessions = byChannel[ch];
      if (chSessions.length === 0) {
        lines.push("*(no sessions yet)*");
      } else {
        for (const e of chSessions) {
          lines.push(`- ${e.date}: ${e.topic} (${e.status}) — ${e.file}`);
        }
      }
    }
  }

  lines.push("");
  fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
}

function getBranchFromIndex(index: { active: IndexEntry[]; archived: IndexEntry[] }): string {
  const allEntries = [...index.active, ...index.archived];
  for (const e of allEntries) {
    if (e.channel) return e.channel;
  }
  return "main";
}

function buildByTopic(index: { active: IndexEntry[]; archived: IndexEntry[] }): Record<string, IndexEntry[]> {
  const byTopic: Record<string, IndexEntry[]> = {};
  for (const e of [...index.active, ...index.archived]) {
    const key = e.topic.toLowerCase();
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(e);
  }
  return byTopic;
}

function buildByChannel(index: { active: IndexEntry[]; archived: IndexEntry[] }): Record<string, IndexEntry[]> {
  const byChannel: Record<string, IndexEntry[]> = {};
  for (const e of [...index.active, ...index.archived]) {
    const key = e.channel || "main";
    if (!byChannel[key]) byChannel[key] = [];
    byChannel[key].push(e);
  }
  return byChannel;
}

export function sessionMetaToIndexEntry(meta: SessionMeta): IndexEntry {
  return {
    date: meta.date,
    topic: meta.topic,
    goal: meta.goal,
    status: meta.status,
    file: `${meta.sessionId}.md`,
    channel: meta.channel,
  };
}
