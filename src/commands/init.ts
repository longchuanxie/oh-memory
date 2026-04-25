import * as fs from "fs";
import * as path from "path";
import { checkbox } from "@inquirer/prompts";
import { renderTemplate, TemplateVars } from "../renderer";
import { scanProject, ProjectInfo } from "../scanner";
import { detectInstalledIDEs, IDE_CONFIGS, IDEConfig, getIDEById } from "../ide-detector";

const TEMPLATE_DIR = path.resolve(__dirname, "..", "..", "templates");

interface FileToCreate {
  templatePath: string;
  outputPath: string;
  isBinary?: boolean;
}

const FILES: FileToCreate[] = [
  { templatePath: "BOOT.md", outputPath: ".ai-context/BOOT.md" },
  { templatePath: "PROJECT.md", outputPath: ".ai-context/PROJECT.md" },
  { templatePath: "ARCHITECTURE.md", outputPath: ".ai-context/ARCHITECTURE.md" },
  { templatePath: "DECISIONS.md", outputPath: ".ai-context/DECISIONS.md" },
  { templatePath: "PATTERNS.md", outputPath: ".ai-context/PATTERNS.md" },
  { templatePath: "WORKING.md", outputPath: ".ai-context/WORKING.md" },
  { templatePath: "CHECKPOINT.json", outputPath: ".ai-context/CHECKPOINT.json" },
  { templatePath: "GLOSSARY.md", outputPath: ".ai-context/GLOSSARY.md" },
  { templatePath: "PCP.md", outputPath: ".ai-context/PCP.md" },
  { templatePath: "SESSIONS_INDEX.md", outputPath: ".ai-context/SESSIONS/INDEX.md" },
  { templatePath: "BRANCH_NAMING.md", outputPath: ".ai-context/BRANCH_NAMING.md" },
  { templatePath: "mcp-bridge.json", outputPath: ".ai-context/mcp-bridge.json" },
  { templatePath: "scripts/cleanup.sh", outputPath: ".ai-context/scripts/cleanup.sh" },
  { templatePath: "scripts/recovery.sh", outputPath: ".ai-context/scripts/recovery.sh" },
  { templatePath: "scripts/cleanup.ps1", outputPath: ".ai-context/scripts/cleanup.ps1" },
  { templatePath: "scripts/recovery.ps1", outputPath: ".ai-context/scripts/recovery.ps1" },
  { templatePath: "scripts/export-context.sh", outputPath: ".ai-context/scripts/export-context.sh" },
  { templatePath: "scripts/import-context.sh", outputPath: ".ai-context/scripts/import-context.sh" },
  { templatePath: "scripts/export-context.ps1", outputPath: ".ai-context/scripts/export-context.ps1" },
  { templatePath: "scripts/import-context.ps1", outputPath: ".ai-context/scripts/import-context.ps1" },
];

const DIRECTORIES = [
  ".ai-context",
  ".ai-context/SESSIONS",
  ".ai-context/SESSIONS/WORKING",
  ".ai-context/SESSIONS/ARCHIVED",
  ".ai-context/SESSIONS/TEMP",
  ".ai-context/KNOWLEDGE",
  ".ai-context/KNOWLEDGE/domain",
  ".ai-context/KNOWLEDGE/tech",
  ".ai-context/scripts",
];

interface IDETemplateMapping {
  files: { templatePath: string; outputPath: string }[];
}

const IDE_TEMPLATE_MAP: Record<string, IDETemplateMapping> = {
  opencode: {
    files: [
      { templatePath: "ide/opencode/opencode.json", outputPath: ".opencode/opencode.json" },
      { templatePath: "ide/opencode/agents/pcp.md", outputPath: ".opencode/agents/pcp.md" },
    ],
  },
  cursor: {
    files: [{ templatePath: "ide/cursor/pcp.mdc", outputPath: ".cursor/rules/pcp.mdc" }],
  },
  windsurf: {
    files: [{ templatePath: "ide/windsurf/rules.md", outputPath: ".windsurf/rules" }],
  },
  trae: {
    files: [{ templatePath: "ide/trae/project_rules.md", outputPath: ".trae/rules/project_rules.md" }],
  },
  "claude-code": {
    files: [{ templatePath: "ide/claude-code/CLAUDE.md", outputPath: "CLAUDE.md" }],
  },
  copilot: {
    files: [{ templatePath: "ide/copilot/copilot-instructions.md", outputPath: ".github/copilot-instructions.md" }],
  },
};

const PCP_INSTRUCTIONS = [
  ".ai-context/BOOT.md",
  ".ai-context/ARCHITECTURE.md",
  ".ai-context/PATTERNS.md",
  ".ai-context/DECISIONS.md",
  ".ai-context/WORKING.md",
  ".ai-context/GLOSSARY.md",
  ".ai-context/SESSIONS/INDEX.md",
];

function resolveTemplateDir(projectDir: string): string {
  const customDir = path.join(projectDir, ".pcp-templates");
  if (fs.existsSync(customDir)) {
    return customDir;
  }
  if (fs.existsSync(TEMPLATE_DIR)) {
    return TEMPLATE_DIR;
  }
  const srcTemplateDir = path.resolve(__dirname, "..", "..", "..", "templates");
  if (fs.existsSync(srcTemplateDir)) {
    return srcTemplateDir;
  }
  return TEMPLATE_DIR;
}

function readTemplate(templateDir: string, templatePath: string): string {
  const fullPath = path.join(templateDir, templatePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, "utf-8");
  }
  const builtinPath = path.join(TEMPLATE_DIR, templatePath);
  return fs.readFileSync(builtinPath, "utf-8");
}

async function selectIDEs(ideFlag: string | boolean | undefined): Promise<string[]> {
  const installedIDEs = detectInstalledIDEs();

  if (ideFlag && typeof ideFlag === "string") {
    const selected = ideFlag.split(",").map((s) => s.trim());
    return selected.filter((id) => getIDEById(id));
  }

  if (installedIDEs.length === 0) {
    return [];
  }

  try {
    const choices = installedIDEs.map((ide) => ({
      name: ide.name,
      value: ide.id,
    }));

    const selected = await checkbox({
      message: "Select AI tools to configure (Space: select, Enter: confirm)",
      choices,
      instructions: false,
    });

    return selected as string[];
  } catch {
    return [];
  }
}

function generateIDEConfig(
  ideId: string,
  projectDir: string,
  templateDir: string,
  vars: TemplateVars,
  dryRun: boolean,
  force: boolean
): { created: string[]; skipped: string[] } {
  const created: string[] = [];
  const skipped: string[] = [];
  const mapping = IDE_TEMPLATE_MAP[ideId];

  if (!mapping) {
    return { created, skipped };
  }

  for (const file of mapping.files) {
    const outputPath = path.join(projectDir, file.outputPath);

    if (fs.existsSync(outputPath) && !force) {
      if (file.outputPath.endsWith("opencode.json")) {
        try {
          const existingContent = fs.readFileSync(outputPath, "utf-8");
          const config = JSON.parse(existingContent);
          const existingInstructions: string[] = config.instructions || [];
          const missingInstructions = PCP_INSTRUCTIONS.filter((i) => !existingInstructions.includes(i));

          if (missingInstructions.length > 0) {
            config.instructions = [...existingInstructions, ...missingInstructions];
            if (dryRun) {
              console.log(`  [append] ${file.outputPath} (adding ${missingInstructions.length} PCP instructions)`);
            } else {
              const outputDir = path.dirname(outputPath);
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
              }
              fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
            }
            created.push(file.outputPath);
          } else {
            skipped.push(`${file.outputPath} (already has PCP instructions)`);
          }
        } catch {
          skipped.push(`${file.outputPath} (parse error, skipped)`);
        }
      } else {
        skipped.push(`${file.outputPath} (already exists)`);
      }
      continue;
    }

    const template = readTemplate(templateDir, file.templatePath);
    const { content } = renderTemplate(template, vars);

    if (dryRun) {
      console.log(`  [file] ${file.outputPath}`);
    } else {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, content, "utf-8");
    }
    created.push(file.outputPath);
  }

  return { created, skipped };
}

export async function initCommand(flags: Record<string, string | boolean>, _positional: string[]): Promise<void> {
  const projectDir = process.cwd();
  const contextDir = path.join(projectDir, ".ai-context");
  const dryRun = !!flags.dryRun;
  const interactive = !!flags.interactive;
  const force = !!flags.force;

  console.log("=== PCP Init ===\n");

  if (fs.existsSync(contextDir)) {
    if (!force) {
      console.log("⚠ .ai-context/ already exists.");
      console.log("Use --force to overwrite, or remove .ai-context/ first.");
      console.log("Existing files will be preserved. Only missing files will be created.\n");
    }
  }

  const projectInfo = scanProject(projectDir);
  const vars: TemplateVars = {
    projectName: projectInfo.projectName,
    projectPurpose: projectInfo.projectPurpose || "A software project",
    techStack: projectInfo.techStack || "Not detected",
    currentPhase: projectInfo.currentPhase,
    branch: projectInfo.branch,
    directoryStructure: projectInfo.directoryStructure,
    date: projectInfo.date,
  };

  const selectedIDEs = await selectIDEs(flags.ide);

  if (interactive) {
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (prompt: string, defaultVal: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(`${prompt} [${defaultVal}]: `, (ans: string) => {
          resolve(ans.trim() || defaultVal);
        });
      });
    };

    vars.projectName = await ask("Project name", vars.projectName);
    vars.projectPurpose = await ask("Project purpose", vars.projectPurpose);
    vars.techStack = await ask("Tech stack", vars.techStack);
    vars.currentPhase = await ask("Current phase", vars.currentPhase);
    rl.close();
  }

  const templateDir = resolveTemplateDir(projectDir);
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];
  const allUnresolved: string[] = [];

  if (dryRun) {
    console.log("Dry run — the following files would be created:\n");
  }

  for (const dir of DIRECTORIES) {
    const dirPath = path.join(projectDir, dir);
    if (!fs.existsSync(dirPath)) {
      if (dryRun) {
        console.log(`  [dir]  ${dir}/`);
      } else {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  for (const file of FILES) {
    const outputPath = path.join(projectDir, file.outputPath);
    const shouldWrite = !fs.existsSync(outputPath) || force;

    if (!shouldWrite) {
      skippedFiles.push(file.outputPath);
      continue;
    }

    const template = readTemplate(templateDir, file.templatePath);
    const { content, unresolved } = renderTemplate(template, vars);
    allUnresolved.push(...unresolved);

    if (dryRun) {
      console.log(`  [file] ${file.outputPath}${unresolved.length > 0 ? ` (unresolved: ${unresolved.join(", ")})` : ""}`);
    } else {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, content, "utf-8");
    }
    createdFiles.push(file.outputPath);
  }

  const gitkeepDirs = [
    ".ai-context/SESSIONS/WORKING/.gitkeep",
    ".ai-context/SESSIONS/ARCHIVED/.gitkeep",
    ".ai-context/SESSIONS/TEMP/.gitkeep",
    ".ai-context/KNOWLEDGE/domain/.gitkeep",
    ".ai-context/KNOWLEDGE/tech/.gitkeep",
    ".ai-context/scripts/.gitkeep",
  ];

  for (const gk of gitkeepDirs) {
    const gkPath = path.join(projectDir, gk);
    if (!fs.existsSync(gkPath)) {
      if (dryRun) {
        console.log(`  [file] ${gk}`);
      } else {
        fs.writeFileSync(gkPath, "", "utf-8");
      }
      createdFiles.push(gk);
    }
  }

  if (!projectInfo.hasAgentsMd || force) {
    const agentsTemplate = readTemplate(templateDir, "AGENTS.md");
    const { content: agentsContent, unresolved: agentsUnresolved } = renderTemplate(agentsTemplate, vars);
    allUnresolved.push(...agentsUnresolved);
    const agentsPath = path.join(projectDir, "AGENTS.md");
    if (dryRun) {
      console.log(`  [file] AGENTS.md${agentsUnresolved.length > 0 ? ` (unresolved: ${agentsUnresolved.join(", ")})` : ""}`);
    } else {
      fs.writeFileSync(agentsPath, agentsContent, "utf-8");
    }
    createdFiles.push("AGENTS.md");
  } else {
    // AGENTS.md exists, append PCP reference instead of overwriting
    const existingAgents = fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8");
    const pcpReference = "\n\n## Project Context Protocol (PCP)\n\nSee `.ai-context/PCP.md` for PCP instructions.\n";
    if (!existingAgents.includes(".ai-context/PCP.md") && !existingAgents.includes("Project Context Protocol")) {
      if (dryRun) {
        console.log(`  [append] AGENTS.md (adding PCP reference)`);
      } else {
        fs.appendFileSync(path.join(projectDir, "AGENTS.md"), pcpReference, "utf-8");
      }
      createdFiles.push("AGENTS.md (appended PCP reference)");
    } else {
      skippedFiles.push("AGENTS.md (already has PCP reference)");
    }
  }

  if (!projectInfo.hasGitignore || force) {
    const gitignoreTemplate = readTemplate(templateDir, "gitignore");
    const gitignorePath = path.join(projectDir, ".gitignore");
    if (dryRun) {
      console.log(`  [file] .gitignore`);
    } else {
      fs.writeFileSync(gitignorePath, gitignoreTemplate, "utf-8");
    }
    createdFiles.push(".gitignore");
  } else {
    const existingGitignore = fs.readFileSync(path.join(projectDir, ".gitignore"), "utf-8");
    if (!existingGitignore.includes(".ai-context/SESSIONS/TEMP/")) {
      const gitignoreTemplate = readTemplate(templateDir, "gitignore");
      if (dryRun) {
        console.log(`  [append] .gitignore (adding PCP rules)`);
      } else {
        fs.appendFileSync(path.join(projectDir, ".gitignore"), `\n${gitignoreTemplate}`, "utf-8");
      }
      createdFiles.push(".gitignore (appended)");
    } else {
      skippedFiles.push(".gitignore (already has PCP rules)");
    }
  }

  if (selectedIDEs.length > 0) {
    console.log("\n🔧 Generating IDE configurations...");
    for (const ideId of selectedIDEs) {
      const result = generateIDEConfig(ideId, projectDir, templateDir, vars, dryRun, force);
      createdFiles.push(...result.created);
      skippedFiles.push(...result.skipped);
    }
  }

  if (dryRun) {
    console.log(`\n${createdFiles.length} files would be created, ${skippedFiles.length} skipped.`);
  } else {
    console.log(`\n✓ PCP initialized successfully!`);
    console.log(`  Created: ${createdFiles.length} files`);
    if (skippedFiles.length > 0) {
      console.log(`  Skipped: ${skippedFiles.length} files (already exist)`);
    }
  }

  if (allUnresolved.length > 0) {
    const unique = [...new Set(allUnresolved)];
    console.log(`\n⚠ Unresolved template variables: ${unique.join(", ")}`);
    console.log("  Edit the generated files to fill in these values.");
  }

  console.log("\nNext steps:");
  console.log("  1. Review .ai-context/BOOT.md — your project's quick snapshot");
  console.log("  2. Edit .ai-context/ARCHITECTURE.md — define your system design");
  console.log("  3. Start a new AI session — AGENTS.md auto-loads BOOT.md");

  if (selectedIDEs.length > 0) {
    console.log("\nConfigured AI tools:");
    selectedIDEs.forEach((id) => {
      const ide = getIDEById(id);
      const mapping = IDE_TEMPLATE_MAP[id];
      if (ide && mapping) {
        const paths = mapping.files.map((f) => f.outputPath).join(", ");
        console.log(`  • ${ide.name}: ${paths}`);
      }
    });
  } else {
    console.log("\nTo configure AI tools, run with --ide flag or use interactive mode (-i)");
    console.log("  Supported: opencode, cursor, windsurf, trae, claude-code, copilot");
  }
}
