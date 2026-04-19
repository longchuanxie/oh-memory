import path from 'path'
import { promises as fs } from 'fs'

import { Logger } from '../utils/logger.js'

import type {
  ProjectArchitecture,
  CodeStyle,
  DirectoryNode,
} from '../types/index.js'

/**
 * DocGenerator - Responsible for generating documentation files
 *
 * This class handles the generation of architecture documentation and
 * code style guides based on project analysis results.
 */
export class DocGenerator {
  private basePath: string
  private logger = Logger.getInstance()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  /**
   * Generate architecture documentation based on project analysis
   *
   * @param architecture - Project architecture analysis result
   */
  async generateArchitectureDoc(architecture: ProjectArchitecture): Promise<void> {
    try {
      if (architecture.structure.totalFiles === 0) {
        const content = `# Project Architecture

## Overview

This is an empty project. No files have been detected.

Please add source files and run \`/memory-ingest\` to generate architecture analysis.
`
        await fs.writeFile(path.join(this.basePath, 'architecture.md'), content, 'utf-8')
        return
      }

      if (architecture.structure.totalFiles === 1) {
        const content = `# Project Architecture

## Overview

This is a single-file project with minimal structure.

- **Total Files**: 1
- **Last Analyzed**: ${architecture.lastAnalyzed.split('T')[0]}

Consider organizing your code into a proper project structure for better maintainability.
`
        await fs.writeFile(path.join(this.basePath, 'architecture.md'), content, 'utf-8')
        return
      }

      const content = `# Project Architecture

## Overview

- **Structure Score**: ${architecture.structureScore.total}/100 (${architecture.structureScore.level})
- **Total Files**: ${architecture.structure.totalFiles}
- **Total Directories**: ${architecture.structure.totalDirs}
- **Max Depth**: ${architecture.structure.maxDepth}
- **Last Analyzed**: ${architecture.lastAnalyzed.split('T')[0]}

## Structure Score Breakdown

| Category | Score | Description |
|----------|-------|-------------|
| Directory Structure | ${architecture.structureScore.directory}/30 | Standard directories and module organization |
| Configuration | ${architecture.structureScore.config}/30 | Package manager, lint, and test configs |
| Code Organization | ${architecture.structureScore.organization}/25 | Naming consistency and module boundaries |
| Documentation | ${architecture.structureScore.documentation}/15 | README, API docs, architecture docs |

## Technology Stack

### Languages

${architecture.techStack.languages.map(l =>
  `- **${l.name}**: ${l.percentage}% (${l.fileCount} files)`
).join('\n')}

### Frameworks

${architecture.techStack.frameworks.length > 0
  ? architecture.techStack.frameworks.map(f => `- **${f.name}** (${f.version})`).join('\n')
  : '- No major frameworks detected'}

### Key Libraries

${architecture.techStack.libraries.slice(0, 10).map(l =>
  `- **${l.name}** (${l.version}) - ${l.type}`
).join('\n')}

### Tools & Configuration

- **Package Manager**: ${architecture.techStack.packageManager || 'Not detected'}
- **Build Tool**: ${architecture.techStack.buildTool || 'Not detected'}
- **Test Framework**: ${architecture.techStack.testFramework || 'Not detected'}

## Module Structure

${architecture.modules.length > 0
  ? architecture.modules.map(m =>
      `### ${m.name}\n\n- **Path**: \`${m.path}\`\n- **Type**: ${m.type}\n- **Files**: ${m.fileCount}`
    ).join('\n\n')
  : 'No standard modules detected'}

## Entry Points

${architecture.entryPoints.length > 0
  ? architecture.entryPoints.map(e => `- \`${e}\``).join('\n')
  : 'No standard entry points detected'}

## Architecture Layers

${architecture.layers.length > 0
  ? architecture.layers.map(l =>
      `### ${l.name}\n\n${l.purpose}\n\n**Directories**: ${l.directories.map(d => `\`${d}\``).join(', ')}`
    ).join('\n\n')
  : 'No distinct layers detected'}

## Directory Tree

\`\`\`
${this.renderDirectoryTree(architecture.structure.directories, 0).slice(0, 100)}
\`\`\`
`

      await fs.writeFile(
        path.join(this.basePath, 'architecture.md'),
        content,
        'utf-8'
      )
    } catch (error) {
      this.logger.error('[oh-memory] Failed to generate architecture doc', error)
    }
  }

  /**
   * Render directory tree structure as a string
   *
   * @param nodes - Directory nodes to render
   * @param depth - Current depth level
   * @returns Formatted directory tree string
   */
  renderDirectoryTree(nodes: DirectoryNode[], depth: number): string {
    if (nodes.length === 0) {
      return ''
    }

    const lines: string[] = []
    const indent = '  '.repeat(depth)

    for (const node of nodes.slice(0, 20)) {
      const prefix = depth === 0 ? '' : indent + '├── '
      lines.push(`${prefix}${node.name}/`)

      if (node.children && depth < 3) {
        for (const child of node.children.slice(0, 10)) {
          if (child.type === 'directory') {
            lines.push(`${indent}    ├── ${child.name}/`)
          }
        }
        if (node.children.length > 10) {
          lines.push(`${indent}    └── ... (${node.children.length - 10} more)`)
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * Generate code style documentation
   *
   * @param styles - Array of code style analysis results
   */
  async generateCodeStyleDoc(styles: CodeStyle[]): Promise<void> {
    if (styles.length === 0) {
      return
    }

    try {
      const content = `# Code Style Guide

## Overview

This document describes the code style conventions detected in the project.

${styles.map(style => `
## ${style.language}

### Summary

${style.summary}

### Naming Conventions

| Type | Style | Consistency | Examples |
|------|-------|-------------|----------|
${style.namingConventions.map(nc =>
  `| ${nc.type} | ${nc.style} | ${Math.round(nc.consistency * 100)}% | ${nc.examples.slice(0, 3).join(', ')} |`
).join('\n')}

### Formatting

- **Indent**: ${style.formatting.indent} (${style.formatting.indentSize} spaces)
- **Semicolons**: ${style.formatting.semicolons ? 'Yes' : 'No'}
- **Quotes**: ${style.formatting.quotes}
- **Trailing Comma**: ${style.formatting.trailingComma ? 'Yes' : 'No'}

### Best Practices

${style.bestPractices.map(bp =>
  `- **${bp.name}**: ${bp.status === 'adopted' ? 'adopted' : bp.status === 'partial' ? 'partial' : 'missing'} ${bp.description}${bp.evidence ? ` (${bp.evidence})` : ''}`
).join('\n')}
`).join('\n')}

## Recommendations

${this.generateStyleRecommendations(styles)}
`

      await fs.writeFile(
        path.join(this.basePath, 'code-style.md'),
        content,
        'utf-8'
      )
    } catch (error) {
      this.logger.error('[oh-memory] Failed to generate code style doc', error)
    }
  }

  /**
   * Generate style recommendations based on missing best practices
   *
   * @param styles - Array of code style analysis results
   * @returns Formatted recommendations string
   */
  private generateStyleRecommendations(styles: CodeStyle[]): string {
    const recommendations: string[] = []

    for (const style of styles) {
      const missing = style.bestPractices.filter(bp => bp.status === 'missing')
      for (const bp of missing) {
        recommendations.push(`- Consider adopting **${bp.name}** for ${style.language}: ${bp.description}`)
      }
    }

    if (recommendations.length === 0) {
      return 'All detected best practices are adopted. Keep up the good work!'
    }

    return recommendations.join('\n')
  }
}
