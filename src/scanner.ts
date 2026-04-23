import * as fs from "fs";
import * as path from "path";

export interface ProjectInfo {
  projectName: string;
  projectPurpose: string;
  techStack: string;
  currentPhase: string;
  branch: string;
  directoryStructure: string;
  date: string;
  hasAgentsMd: boolean;
  hasGitignore: boolean;
  [key: string]: string | boolean;
}

export function scanProject(projectDir: string): ProjectInfo {
  const date = new Date().toISOString().split("T")[0];
  const info: ProjectInfo = {
    projectName: path.basename(projectDir),
    projectPurpose: "",
    techStack: "",
    currentPhase: "development",
    branch: "main",
    directoryStructure: scanDirectoryStructure(projectDir),
    date,
    hasAgentsMd: fs.existsSync(path.join(projectDir, "AGENTS.md")),
    hasGitignore: fs.existsSync(path.join(projectDir, ".gitignore")),
  };

  scanPackageJson(projectDir, info);
  scanPyprojectToml(projectDir, info);
  scanCargoToml(projectDir, info);
  scanGoMod(projectDir, info);
  scanPomXml(projectDir, info);
  scanBuildGradle(projectDir, info);
  scanGitInfo(projectDir, info);

  return info;
}

function scanPackageJson(projectDir: string, info: ProjectInfo): void {
  const filePath = path.join(projectDir, "package.json");
  if (!fs.existsSync(filePath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (pkg.name && info.projectName === path.basename(projectDir)) {
      info.projectName = pkg.name;
    }
    if (pkg.description) {
      info.projectPurpose = pkg.description;
    }
    const deps: string[] = [];
    if (pkg.dependencies) deps.push(...Object.keys(pkg.dependencies));
    if (pkg.devDependencies) deps.push(...Object.keys(pkg.devDependencies));
    if (deps.length > 0) {
      const existing = info.techStack ? info.techStack.split(", ") : [];
      const merged = [...new Set([...existing, "Node.js", ...deps.slice(0, 5)])];
      info.techStack = merged.join(", ");
    } else {
      info.techStack = info.techStack ? `${info.techStack}, Node.js` : "Node.js";
    }
  } catch {
    // ignore parse errors
  }
}

function scanPyprojectToml(projectDir: string, info: ProjectInfo): void {
  const filePath = path.join(projectDir, "pyproject.toml");
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) info.projectName = nameMatch[1];

  const descMatch = content.match(/^description\s*=\s*"([^"]+)"/m);
  if (descMatch) info.projectPurpose = descMatch[1];

  const existing = info.techStack ? info.techStack.split(", ") : [];
  const merged = [...new Set([...existing, "Python"])];
  info.techStack = merged.join(", ");
}

function scanCargoToml(projectDir: string, info: ProjectInfo): void {
  const filePath = path.join(projectDir, "Cargo.toml");
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) info.projectName = nameMatch[1];

  const existing = info.techStack ? info.techStack.split(", ") : [];
  const merged = [...new Set([...existing, "Rust"])];
  info.techStack = merged.join(", ");
}

function scanGoMod(projectDir: string, info: ProjectInfo): void {
  const filePath = path.join(projectDir, "go.mod");
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const moduleMatch = content.match(/^module\s+(\S+)/m);
  if (moduleMatch) {
    const modPath = moduleMatch[1];
    info.projectName = modPath.split("/").pop() || info.projectName;
  }

  const existing = info.techStack ? info.techStack.split(", ") : [];
  const merged = [...new Set([...existing, "Go"])];
  info.techStack = merged.join(", ");
}

function scanPomXml(projectDir: string, info: ProjectInfo): void {
  const filePath = path.join(projectDir, "pom.xml");
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const nameMatch = content.match(/<name>([^<]+)<\/name>/);
  if (nameMatch) info.projectName = nameMatch[1].trim();

  const descMatch = content.match(/<description>([^<]+)<\/description>/);
  if (descMatch) info.projectPurpose = descMatch[1].trim();

  const groupIdMatch = content.match(/<groupId>([^<]+)<\/groupId>/);
  const artifactIdMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
  if (!nameMatch && artifactIdMatch) {
    info.projectName = artifactIdMatch[1].trim();
  }

  const existing = info.techStack ? info.techStack.split(", ") : [];
  const merged = [...new Set([...existing, "Java", "Maven"])];
  info.techStack = merged.join(", ");
}

function scanBuildGradle(projectDir: string, info: ProjectInfo): void {
  const ktsPath = path.join(projectDir, "build.gradle.kts");
  const groovyPath = path.join(projectDir, "build.gradle");
  const filePath = fs.existsSync(ktsPath) ? ktsPath : groovyPath;
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");

  const rootProjectMatch = content.match(/rootProject\.name\s*=\s*["']([^"']+)["']/);
  if (rootProjectMatch) {
    info.projectName = rootProjectMatch[1];
  }

  const groupMatch = content.match(/^group\s*=\s*["']([^"']+)["']/m);
  const existing = info.techStack ? info.techStack.split(", ") : [];
  const isKts = filePath.endsWith(".kts");
  const merged = [...new Set([...existing, "Java", isKts ? "Gradle (Kotlin DSL)" : "Gradle"])];
  info.techStack = merged.join(", ");
}

function scanGitInfo(projectDir: string, info: ProjectInfo): void {
  try {
    const { execSync } = require("child_process");
    const branch = execSync("git branch --show-current", { cwd: projectDir, encoding: "utf-8" }).trim();
    if (branch) info.branch = branch;
  } catch {
    // not a git repo or git not available
  }
}

function scanDirectoryStructure(projectDir: string): string {
  const entries: string[] = [];
  try {
    const topItems = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const item of topItems) {
      if (item.name.startsWith(".") && item.name !== ".github") continue;
      if (item.name === "node_modules" || item.name === "dist" || item.name === "build") continue;

      if (item.isDirectory()) {
        entries.push(`${item.name}/`);
        try {
          const subItems = fs.readdirSync(path.join(projectDir, item.name), { withFileTypes: true });
          for (const sub of subItems.slice(0, 5)) {
            if (sub.name.startsWith(".")) continue;
            entries.push(`  ${sub.isDirectory() ? `${sub.name}/` : sub.name}`);
          }
          if (subItems.length > 5) entries.push("  ...");
        } catch {
          // permission denied, skip
        }
      } else {
        entries.push(item.name);
      }
    }
  } catch {
    // permission denied, return empty
  }
  return entries.join("\n");
}
