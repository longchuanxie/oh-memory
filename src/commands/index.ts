import { initCommand } from "./init";
import { statusCommand } from "./status";
import { cleanupCommand } from "./cleanup";
import { recoveryCommand } from "./recovery";
import { exportCommand } from "./export";
import { importCommand } from "./import-cmd";
import { checkpointCommand } from "./checkpoint";
import { sessionCommand } from "./session";
import { updateCommand } from "./update";

const VERSION = "0.2.0";

function parseArgs(args: string[]): { command: string; subcommand: string; flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = "";
  let subcommand = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--version" || arg === "-v") {
      flags.version = true;
    } else if (arg === "--interactive" || arg === "-i") {
      flags.interactive = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--yes" || arg === "-y") {
      flags.yes = true;
    } else if (arg === "--force" || arg === "-f") {
      flags.force = true;
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--archived" || arg === "--all") {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else if (!subcommand && command === "session") {
      subcommand = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, subcommand, flags, positional };
}

function showHelp(): void {
  console.log(`pcp — Project Context Protocol CLI

Compatible with: OpenCode, Claude Code, Cursor, Trae, Windsurf, and any agent that reads AGENTS.md.

Usage: pcp <command> [options]

Commands:
  init        Initialize PCP in the current project
  status      Show PCP context status
  update      Re-scan project and update context files
  session     Manage AI coding sessions (start/end/list/search/archive)
  checkpoint  Save current progress checkpoint
  recovery    Check for abnormal session termination
  cleanup     Clean up old session files
  export      Export context to archive
  import      Import context from archive

Session Subcommands:
  start <topic>     Start a new session
  end [session-id]  End an active session
  list              List active sessions
  search <query>    Search sessions by keyword
  archive <id>      Archive a completed session

Options:
  -h, --help       Show this help message
  -v, --version    Show version number

Init Options:
  -i, --interactive    Interactive mode (detect and select AI tools)
      --dry-run        Preview without writing files
      --ide <tools>    Configure specific AI tools (comma-separated)
                       Supported: opencode, cursor, windsurf, trae, claude-code, copilot
  -f, --force          Overwrite existing files

Session Options:
  --topic <topic>   Session topic (for start)
  --goal <goal>     Session goal (for start)
  --session <id>    Session ID (for end/archive)
  --archived        Include archived sessions in list
  --all             Include archived sessions in list

Recovery Options:
  --json            Output recovery status as JSON

Update Options:
      --dry-run        Preview changes without writing files

Checkpoint Options:
  --session <id>    Session ID
  --status <s>      Set checkpoint status
  --phase <p>       Set current phase
  --goal <g>        Set goal
  --completed <items>  Comma-separated completed items
  --inProgress <item>  Current in-progress item
  --remaining <items>  Comma-separated remaining items
  --created <files>    Comma-separated created files
  --modified <files>   Comma-separated modified files
  --channel <ch>    Set channel

Examples:
  npx pcp init                          # Auto-detect and initialize
  npx pcp init -i                       # Interactive mode
  npx pcp init --ide cursor,trae        # Configure specific tools
  npx pcp status                        # Check context status
  npx pcp update                        # Re-scan and update context
  npx pcp session start feature-auth    # Start a new session
  npx pcp session end                   # End current session
  npx pcp session list                  # List active sessions
  npx pcp session search "auth"         # Search sessions
  npx pcp session archive 2026-04-25-feature-auth
  npx pcp checkpoint --completed "step1,step2"
  npx pcp recovery                      # Check for stale sessions
  npx pcp recovery --json               # Machine-readable output
`);
}

export async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, subcommand, flags, positional } = parseArgs(args);

  if (flags.version) {
    console.log(`pcp v${VERSION}`);
    return;
  }

  if (flags.help || !command) {
    showHelp();
    return;
  }

  if (command === "session") {
    const sessionPositional = subcommand ? [subcommand, ...positional] : positional;
    await sessionCommand(flags, sessionPositional);
    return;
  }

  const commandMap: Record<string, (flags: Record<string, string | boolean>, positional: string[]) => Promise<void>> = {
    init: initCommand,
    status: statusCommand,
    update: updateCommand,
    cleanup: cleanupCommand,
    recovery: recoveryCommand,
    export: exportCommand,
    import: importCommand,
    checkpoint: checkpointCommand,
  };

  const handler = commandMap[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'pcp --help' for available commands.");
    process.exit(1);
  }

  await handler(flags, positional);
}
