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
exports.sessionCommand = sessionCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_manager_1 = require("./session-manager");
const index_manager_1 = require("./index-manager");
const checkpoint_1 = require("./checkpoint");
const CONTEXT_DIR = ".ai-context";
function ensurePCP(projectDir) {
    if (!fs.existsSync(path.join(projectDir, CONTEXT_DIR))) {
        console.error("PCP not initialized. Run 'pcp init' first.");
        return false;
    }
    return true;
}
async function sessionCommand(flags, positional) {
    const projectDir = process.cwd();
    const subcommand = positional[0] || "";
    switch (subcommand) {
        case "start":
            await sessionStart(projectDir, flags, positional);
            break;
        case "end":
            await sessionEnd(projectDir, flags, positional);
            break;
        case "list":
            await sessionList(projectDir, flags);
            break;
        case "search":
            await sessionSearch(projectDir, flags, positional);
            break;
        case "archive":
            await sessionArchive(projectDir, flags, positional);
            break;
        default:
            showSessionHelp();
    }
}
async function sessionStart(projectDir, flags, positional) {
    if (!ensurePCP(projectDir))
        return;
    const topic = positional[1] || flags.topic || "";
    if (!topic) {
        console.error("Usage: pcp session start <topic>");
        console.error("  Or:  pcp session start --topic <topic>");
        process.exit(1);
    }
    const goal = flags.goal || topic;
    const session = (0, session_manager_1.createSession)(projectDir, topic, goal);
    const entry = (0, index_manager_1.sessionMetaToIndexEntry)(session.meta);
    (0, index_manager_1.addActiveSession)(projectDir, entry);
    (0, checkpoint_1.updateCheckpoint)(projectDir, {
        sessionId: session.meta.sessionId,
        status: "in-progress",
        currentPhase: "session started",
        goal,
        inProgress: topic,
    });
    console.log("✓ Session started");
    console.log(`  ID: ${session.meta.sessionId}`);
    console.log(`  Topic: ${topic}`);
    console.log(`  Goal: ${goal}`);
    console.log(`  Channel: ${session.meta.channel}`);
    console.log(`  File: .ai-context/SESSIONS/WORKING/${session.meta.sessionId}.md`);
}
async function sessionEnd(projectDir, flags, positional) {
    if (!ensurePCP(projectDir))
        return;
    const sessionId = positional[1] || flags.session || "";
    if (!sessionId) {
        const working = (0, session_manager_1.listWorkingSessions)(projectDir);
        if (working.length === 0) {
            console.log("No active sessions to end.");
            return;
        }
        if (working.length === 1) {
            const id = working[0].sessionId;
            doEndSession(projectDir, id);
            return;
        }
        console.log("Multiple active sessions. Specify which one:");
        for (const s of working) {
            console.log(`  ${s.sessionId} — ${s.topic}`);
        }
        console.log("\nUsage: pcp session end <session-id>");
        return;
    }
    doEndSession(projectDir, sessionId);
}
function doEndSession(projectDir, sessionId) {
    const success = (0, session_manager_1.endSession)(projectDir, sessionId);
    if (!success)
        return;
    (0, checkpoint_1.updateCheckpoint)(projectDir, {
        sessionId,
        status: "completed",
        currentPhase: "session completed",
    });
    console.log("✓ Session ended");
    console.log(`  ID: ${sessionId}`);
    console.log(`  Status: completed`);
    console.log(`  Use 'pcp session archive ${sessionId}' to archive it.`);
}
async function sessionList(projectDir, flags) {
    if (!ensurePCP(projectDir))
        return;
    const showArchived = !!flags.archived || !!flags.all;
    const working = (0, session_manager_1.listWorkingSessions)(projectDir);
    console.log("=== Active Sessions ===\n");
    if (working.length === 0) {
        console.log("  (none)");
    }
    else {
        for (const s of working) {
            console.log(`  ${s.sessionId}`);
            console.log(`    Topic: ${s.topic}`);
            console.log(`    Goal: ${s.goal}`);
            console.log(`    Channel: ${s.channel}`);
            console.log(`    Date: ${s.date}`);
            console.log("");
        }
    }
    if (showArchived) {
        const archived = (0, session_manager_1.listArchivedSessions)(projectDir);
        console.log("\n=== Archived Sessions ===\n");
        if (archived.length === 0) {
            console.log("  (none)");
        }
        else {
            for (const s of archived.slice(0, 20)) {
                console.log(`  ${s.sessionId} — ${s.topic} (${s.date})`);
            }
            if (archived.length > 20) {
                console.log(`  ... and ${archived.length - 20} more`);
            }
        }
    }
}
async function sessionSearch(projectDir, flags, positional) {
    if (!ensurePCP(projectDir))
        return;
    const query = positional[1] || flags.query || "";
    if (!query) {
        console.error("Usage: pcp session search <query>");
        process.exit(1);
    }
    const results = (0, session_manager_1.searchSessions)(projectDir, query);
    console.log(`=== Search Results for "${query}" ===\n`);
    if (results.length === 0) {
        console.log("  No matching sessions found.");
    }
    else {
        for (const s of results) {
            console.log(`  [${s.status}] ${s.sessionId}`);
            console.log(`    Topic: ${s.topic}`);
            console.log(`    Goal: ${s.goal}`);
            console.log(`    Channel: ${s.channel}`);
            console.log(`    Date: ${s.date}`);
            console.log("");
        }
    }
    console.log(`Found ${results.length} session(s).`);
}
async function sessionArchive(projectDir, flags, positional) {
    if (!ensurePCP(projectDir))
        return;
    const sessionId = positional[1] || flags.session || "";
    if (!sessionId) {
        console.error("Usage: pcp session archive <session-id>");
        process.exit(1);
    }
    const success = (0, session_manager_1.archiveSession)(projectDir, sessionId);
    if (!success)
        return;
    (0, index_manager_1.moveSessionToArchived)(projectDir, sessionId);
    console.log("✓ Session archived");
    console.log(`  ID: ${sessionId}`);
    console.log(`  Moved to: .ai-context/SESSIONS/ARCHIVED/${sessionId}.md`);
}
function showSessionHelp() {
    console.log(`pcp session — Manage AI coding sessions

Usage: pcp session <subcommand> [options]

Subcommands:
  start <topic>     Start a new session
  end [session-id]  End an active session
  list              List active sessions
  search <query>    Search sessions by keyword
  archive <id>      Archive a completed session

Options:
  --topic <topic>   Session topic (for start)
  --goal <goal>     Session goal (for start, defaults to topic)
  --session <id>    Session ID (for end/archive)
  --archived        Include archived sessions in list
  --all             Include archived sessions in list

Examples:
  pcp session start feature-auth
  pcp session start --topic "fix login bug" --goal "Fix the login redirect issue"
  pcp session end
  pcp session end 2026-04-25-feature-auth
  pcp session list
  pcp session list --archived
  pcp session search "auth"
  pcp session archive 2026-04-25-feature-auth
`);
}
//# sourceMappingURL=session.js.map