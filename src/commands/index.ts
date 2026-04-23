import { initCommand } from "./init";
import { statusCommand } from "./status";
import { cleanupCommand } from "./cleanup";
import { recoveryCommand } from "./recovery";
import { exportCommand } from "./export";
import { importCommand } from "./import-cmd";

const VERSION = "0.1.0";

function parseArgs(args: string[]): { command: string; flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = "";

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
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

function showHelp(): void {
  console.log(`pcp — Project Context Protocol CLI

Compatible with: OpenCode, Claude Code, Cursor, Trae, Windsurf, and any agent that reads AGENTS.md.

Usage: pcp <command> [options]

Commands:
  init        Initialize PCP in the current project
  status      Show PCP context status
  cleanup     Clean up old session files
  recovery    Check for abnormal session termination
  export      Export context to archive
  import      Import context from archive

Options:
  -h, --help       Show this help message
  -v, --version    Show version number

Init Options:
  -i, --interactive    Interactive mode (detect and select AI tools)
      --dry-run        Preview without writing files
      --ide <tools>    Configure specific AI tools (comma-separated)
                       Supported: opencode, cursor, windsurf, trae, claude-code, copilot
  -f, --force          Overwrite existing files

Examples:
  npx pcp init                     # Auto-detect and initialize
  npx pcp init -i                  # Interactive mode with AI tool selection
  npx pcp init --ide opencode      # Configure OpenCode only
  npx pcp init --ide cursor,trae   # Configure Cursor and Trae
  npx pcp init --dry-run           # Preview what would be created
  npx pcp status                   # Check context status
`);
}

export async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, flags, positional } = parseArgs(args);

  if (flags.version) {
    console.log(`pcp v${VERSION}`);
    return;
  }

  if (flags.help || !command) {
    showHelp();
    return;
  }

  const commandMap: Record<string, (flags: Record<string, string | boolean>, positional: string[]) => Promise<void>> = {
    init: initCommand,
    status: statusCommand,
    cleanup: cleanupCommand,
    recovery: recoveryCommand,
    export: exportCommand,
    import: importCommand,
  };

  const handler = commandMap[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'pcp --help' for available commands.");
    process.exit(1);
  }

  await handler(flags, positional);
}
