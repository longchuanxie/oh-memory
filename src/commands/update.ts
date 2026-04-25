import * as fs from "fs";
import * as path from "path";
import { scanProject } from "../scanner";
import { renderTemplate, TemplateVars } from "../renderer";

const CONTEXT_DIR = ".ai-context";

export async function updateCommand(
  flags: Record<string, string | boolean>,
  _positional: string[]
): Promise<void> {
  const projectDir = process.cwd();
  const contextDir = path.join(projectDir, CONTEXT_DIR);

  if (!fs.existsSync(contextDir)) {
    console.error("PCP not initialized. Run 'pcp init' first.");
    process.exit(1);
  }

  const dryRun = !!flags.dryRun;
  const force = !!flags.force;

  console.log("=== PCP Update ===\n");

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

  const updatedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const bootPath = path.join(contextDir, "BOOT.md");
  if (fs.existsSync(bootPath)) {
    const existing = fs.readFileSync(bootPath, "utf-8");
    const updated = updateBootContent(existing, vars);
    if (updated !== existing) {
      if (dryRun) {
        console.log("  [update] .ai-context/BOOT.md");
      } else {
        fs.writeFileSync(bootPath, updated, "utf-8");
      }
      updatedFiles.push(".ai-context/BOOT.md");
    } else {
      skippedFiles.push(".ai-context/BOOT.md (no changes)");
    }
  }

  const projectPath = path.join(contextDir, "PROJECT.md");
  if (fs.existsSync(projectPath)) {
    const existing = fs.readFileSync(projectPath, "utf-8");
    const updated = updateProjectContent(existing, vars);
    if (updated !== existing) {
      if (dryRun) {
        console.log("  [update] .ai-context/PROJECT.md");
      } else {
        fs.writeFileSync(projectPath, updated, "utf-8");
      }
      updatedFiles.push(".ai-context/PROJECT.md");
    } else {
      skippedFiles.push(".ai-context/PROJECT.md (no changes)");
    }
  }

  const workingPath = path.join(contextDir, "WORKING.md");
  if (fs.existsSync(workingPath)) {
    const existing = fs.readFileSync(workingPath, "utf-8");
    const updated = updateWorkingBranch(existing, vars.branch);
    if (updated !== existing) {
      if (dryRun) {
        console.log("  [update] .ai-context/WORKING.md (branch)");
      } else {
        fs.writeFileSync(workingPath, updated, "utf-8");
      }
      updatedFiles.push(".ai-context/WORKING.md");
    } else {
      skippedFiles.push(".ai-context/WORKING.md (no changes)");
    }
  }

  if (dryRun) {
    console.log(`\n${updatedFiles.length} files would be updated.`);
  } else {
    console.log(`\n✓ Update complete`);
    console.log(`  Updated: ${updatedFiles.length} files`);
    if (skippedFiles.length > 0) {
      console.log(`  Skipped: ${skippedFiles.length} files`);
    }
  }

  console.log("\nDetected project info:");
  console.log(`  Name: ${vars.projectName}`);
  console.log(`  Purpose: ${vars.projectPurpose}`);
  console.log(`  Tech Stack: ${vars.techStack}`);
  console.log(`  Branch: ${vars.branch}`);
  console.log(`  Phase: ${vars.currentPhase}`);
}

function updateBootContent(existing: string, vars: TemplateVars): string {
  let content = existing;

  content = content.replace(
    /- \*\*Name\*\*: .+/,
    `- **Name**: ${vars.projectName}`
  );
  content = content.replace(
    /- \*\*Purpose\*\*: .+/,
    `- **Purpose**: ${vars.projectPurpose}`
  );
  content = content.replace(
    /- \*\*Tech Stack\*\*: .+/,
    `- **Tech Stack**: ${vars.techStack}`
  );
  content = content.replace(
    /- \*\*Current Phase\*\*: .+/,
    `- **Current Phase**: ${vars.currentPhase}`
  );
  content = content.replace(
    /- \*\*Branch\*\*: .+/,
    `- **Branch**: ${vars.branch}`
  );
  content = content.replace(
    /2\. \*\*Key technology\*\*: .+/,
    `2. **Key technology**: ${vars.techStack}`
  );
  content = content.replace(
    /- \*\*Default\*\*: .+/,
    `- **Default**: ${vars.branch}`
  );

  return content;
}

function updateProjectContent(existing: string, vars: TemplateVars): string {
  let content = existing;

  content = content.replace(
    /## Purpose\n+.+/,
    `## Purpose\n${vars.projectPurpose}`
  );
  content = content.replace(
    /## Tech Stack\n+.+/,
    `## Tech Stack\n${vars.techStack}`
  );
  content = content.replace(
    /- \*\*Phase\*\*: .+/,
    `- **Phase**: ${vars.currentPhase}`
  );

  const dirStructureMatch = content.match(/## Directory Structure\n+```\n[\s\S]*?\n```/);
  if (dirStructureMatch) {
    content = content.replace(
      /## Directory Structure\n+```\n[\s\S]*?\n```/,
      `## Directory Structure\n\`\`\`\n${vars.directoryStructure}\n\`\`\``
    );
  }

  return content;
}

function updateWorkingBranch(existing: string, branch: string): string {
  return existing.replace(
    /## Active Branch\n+.+/,
    `## Active Branch\n${branch}`
  );
}
