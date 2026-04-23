import * as fs from "fs";
import * as path from "path";

export interface IDEConfig {
  id: string;
  name: string;
  configPath: string;
  configFormat: "json" | "markdown" | "mdc";
  hasConfig: (projectDir: string) => boolean;
  detectInstallation: () => boolean;
}

const HOME = process.env.HOME || process.env.USERPROFILE || "";

export const IDE_CONFIGS: IDEConfig[] = [
  {
    id: "opencode",
    name: "OpenCode",
    configPath: "opencode.json",
    configFormat: "json",
    hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, "opencode.json")),
    detectInstallation: () => {
      const configPaths = [
        path.join(HOME, ".config", "opencode", "opencode.json"),
        path.join(HOME, ".config", "opencode", "opencode.jsonc"),
        path.join(HOME, ".local", "state", "opencode", "kv.json"),
      ];
      return configPaths.some((p) => fs.existsSync(p));
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: ".cursor/rules",
    configFormat: "mdc",
    hasConfig: (projectDir) =>
      fs.existsSync(path.join(projectDir, ".cursor", "rules")) ||
      fs.existsSync(path.join(projectDir, ".cursorrules")),
    detectInstallation: () => {
      const cursorPaths = [
        path.join(HOME, ".cursor"),
        path.join(HOME, "AppData", "Local", "Programs", "cursor"),
        "/Applications/Cursor.app",
        "/usr/local/bin/cursor",
      ];
      return cursorPaths.some((p) => fs.existsSync(p));
    },
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configPath: ".windsurf/rules",
    configFormat: "markdown",
    hasConfig: (projectDir) =>
      fs.existsSync(path.join(projectDir, ".windsurf", "rules")) ||
      fs.existsSync(path.join(projectDir, ".windsurfrules")),
    detectInstallation: () => {
      const windsurfPaths = [
        path.join(HOME, ".windsurf"),
        path.join(HOME, "AppData", "Local", "Programs", "windsurf"),
        "/Applications/Windsurf.app",
      ];
      return windsurfPaths.some((p) => fs.existsSync(p));
    },
  },
  {
    id: "trae",
    name: "Trae",
    configPath: ".trae/rules/project_rules.md",
    configFormat: "markdown",
    hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, ".trae", "rules", "project_rules.md")),
    detectInstallation: () => {
      const traePaths = [
        path.join(HOME, ".trae"),
        path.join(HOME, "AppData", "Local", "Programs", "trae"),
        "/Applications/Trae.app",
      ];
      return traePaths.some((p) => fs.existsSync(p));
    },
  },
  {
    id: "claude-code",
    name: "Claude Code",
    configPath: "CLAUDE.md",
    configFormat: "markdown",
    hasConfig: (projectDir) =>
      fs.existsSync(path.join(projectDir, "CLAUDE.md")) ||
      fs.existsSync(path.join(projectDir, "AGENTS.md")),
    detectInstallation: () => {
      return fs.existsSync(path.join(HOME, ".claude"));
    },
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    configPath: ".github/copilot-instructions.md",
    configFormat: "markdown",
    hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, ".github", "copilot-instructions.md")),
    detectInstallation: () => {
      const vscodePaths = [
        path.join(HOME, ".vscode"),
        path.join(HOME, "AppData", "Local", "Programs", "Microsoft VS Code"),
        "/Applications/Visual Studio Code.app",
        "/usr/bin/code",
      ];
      return vscodePaths.some((p) => fs.existsSync(p));
    },
  },
];

export function detectInstalledIDEs(): IDEConfig[] {
  return IDE_CONFIGS.filter((ide) => ide.detectInstallation());
}

export function detectProjectIDEs(projectDir: string): IDEConfig[] {
  return IDE_CONFIGS.filter((ide) => ide.hasConfig(projectDir));
}

export function getIDEById(id: string): IDEConfig | undefined {
  return IDE_CONFIGS.find((ide) => ide.id === id);
}
