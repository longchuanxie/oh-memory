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
exports.updateCommand = updateCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scanner_1 = require("../scanner");
const CONTEXT_DIR = ".ai-context";
async function updateCommand(flags, _positional) {
    const projectDir = process.cwd();
    const contextDir = path.join(projectDir, CONTEXT_DIR);
    if (!fs.existsSync(contextDir)) {
        console.error("PCP not initialized. Run 'pcp init' first.");
        process.exit(1);
    }
    const dryRun = !!flags.dryRun;
    const force = !!flags.force;
    console.log("=== PCP Update ===\n");
    const projectInfo = (0, scanner_1.scanProject)(projectDir);
    const vars = {
        projectName: projectInfo.projectName,
        projectPurpose: projectInfo.projectPurpose || "A software project",
        techStack: projectInfo.techStack || "Not detected",
        currentPhase: projectInfo.currentPhase,
        branch: projectInfo.branch,
        directoryStructure: projectInfo.directoryStructure,
        date: projectInfo.date,
    };
    const updatedFiles = [];
    const skippedFiles = [];
    const bootPath = path.join(contextDir, "BOOT.md");
    if (fs.existsSync(bootPath)) {
        const existing = fs.readFileSync(bootPath, "utf-8");
        const updated = updateBootContent(existing, vars);
        if (updated !== existing) {
            if (dryRun) {
                console.log("  [update] .ai-context/BOOT.md");
            }
            else {
                fs.writeFileSync(bootPath, updated, "utf-8");
            }
            updatedFiles.push(".ai-context/BOOT.md");
        }
        else {
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
            }
            else {
                fs.writeFileSync(projectPath, updated, "utf-8");
            }
            updatedFiles.push(".ai-context/PROJECT.md");
        }
        else {
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
            }
            else {
                fs.writeFileSync(workingPath, updated, "utf-8");
            }
            updatedFiles.push(".ai-context/WORKING.md");
        }
        else {
            skippedFiles.push(".ai-context/WORKING.md (no changes)");
        }
    }
    if (dryRun) {
        console.log(`\n${updatedFiles.length} files would be updated.`);
    }
    else {
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
function updateBootContent(existing, vars) {
    let content = existing;
    content = content.replace(/- \*\*Name\*\*: .+/, `- **Name**: ${vars.projectName}`);
    content = content.replace(/- \*\*Purpose\*\*: .+/, `- **Purpose**: ${vars.projectPurpose}`);
    content = content.replace(/- \*\*Tech Stack\*\*: .+/, `- **Tech Stack**: ${vars.techStack}`);
    content = content.replace(/- \*\*Current Phase\*\*: .+/, `- **Current Phase**: ${vars.currentPhase}`);
    content = content.replace(/- \*\*Branch\*\*: .+/, `- **Branch**: ${vars.branch}`);
    content = content.replace(/2\. \*\*Key technology\*\*: .+/, `2. **Key technology**: ${vars.techStack}`);
    content = content.replace(/- \*\*Default\*\*: .+/, `- **Default**: ${vars.branch}`);
    return content;
}
function updateProjectContent(existing, vars) {
    let content = existing;
    content = content.replace(/## Purpose\n+.+/, `## Purpose\n${vars.projectPurpose}`);
    content = content.replace(/## Tech Stack\n+.+/, `## Tech Stack\n${vars.techStack}`);
    content = content.replace(/- \*\*Phase\*\*: .+/, `- **Phase**: ${vars.currentPhase}`);
    const dirStructureMatch = content.match(/## Directory Structure\n+```\n[\s\S]*?\n```/);
    if (dirStructureMatch) {
        content = content.replace(/## Directory Structure\n+```\n[\s\S]*?\n```/, `## Directory Structure\n\`\`\`\n${vars.directoryStructure}\n\`\`\``);
    }
    return content;
}
function updateWorkingBranch(existing, branch) {
    return existing.replace(/## Active Branch\n+.+/, `## Active Branch\n${branch}`);
}
//# sourceMappingURL=update.js.map