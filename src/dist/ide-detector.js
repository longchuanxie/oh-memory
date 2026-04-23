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
exports.IDE_CONFIGS = void 0;
exports.detectInstalledIDEs = detectInstalledIDEs;
exports.detectProjectIDEs = detectProjectIDEs;
exports.getIDEById = getIDEById;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const HOME = process.env.HOME || process.env.USERPROFILE || "";
exports.IDE_CONFIGS = [
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
        hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, ".cursor", "rules")) ||
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
        hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, ".windsurf", "rules")) ||
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
        hasConfig: (projectDir) => fs.existsSync(path.join(projectDir, "CLAUDE.md")) ||
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
function detectInstalledIDEs() {
    return exports.IDE_CONFIGS.filter((ide) => ide.detectInstallation());
}
function detectProjectIDEs(projectDir) {
    return exports.IDE_CONFIGS.filter((ide) => ide.hasConfig(projectDir));
}
function getIDEById(id) {
    return exports.IDE_CONFIGS.find((ide) => ide.id === id);
}
//# sourceMappingURL=ide-detector.js.map