import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from './logger.js'
import { loadPrompt } from './prompt-loader.js'

const COMMANDS = {
  'memory-init.md': `---
description: Initialize the knowledge base for the project
agent: build
---

Initialize the oh-memory knowledge base for this project.

**Steps:**
1. Call \`memory-init\` tool with the project path to create .memory/ directory structure
2. Show the user the created directory structure
3. Ask if they want to ingest existing project files
4. If yes, proceed with /memory-ingest command

Project directory: $ARGUMENTS
`,
  'memory-ingest.md': `---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

**Single-file workflow (≤5 files):**
1. Call \`memory-read-context\` to get file contents as LLM-ready context
2. Use @wiki-generator sub-agent to generate wiki pages
3. Call \`memory-save-wiki\` for each generated wiki page
4. Call \`memory-build\` to rebuild the knowledge graph

**Batch workflow (>5 files):**
1. Call \`memory-batch-ingest\` with the file list and batch size
2. For each batch returned, delegate to @wiki-generator sub-agent with the prepared prompt
3. For each wiki page the subagent generates, call \`memory-save-wiki\` to persist it
4. After all batches are processed, call \`memory-build\` to rebuild the knowledge graph

**File paths to process:** $ARGUMENTS

**Supported Files:**
- All text-based source files (any extension)
- Binary/compiled files are automatically filtered

**Smart Filtering (always applied):**
- node_modules/, vendor/, Pods/, __pycache__/
- dist/, build/, target/, out/
- .class, .jar, .pyc, .exe, .dll
- package-lock.json, yarn.lock
- .env, .env.local
- .min.js, .min.css

If no files specified, ask the user which files or directories they want to ingest.
`,
  'memory-query.md': `---
description: Query the knowledge base
agent: build
---

Query the knowledge base with the following question: $ARGUMENTS

**Steps:**
1. Call \`memory-query\` tool with the search query
2. Present the answer with citations to source pages
3. Show relevant knowledge pages found
4. Ask if the user wants to save this answer as a new synthesis page

Query: $ARGUMENTS
`,
  'memory-status.md': `---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

**Steps:**
1. Call \`memory-status\` tool to get current state
2. Format the result nicely using markdown tables
3. Highlight any issues (errors in red, warnings in yellow)
4. Suggest actions based on status:
   - If pending changes > 0: suggest running /memory-ingest
   - If graph is empty: suggest running /memory-build

Project directory: $ARGUMENTS
`,
  'memory-build.md': `---
description: Build or rebuild the knowledge graph
agent: build
---

Build or rebuild the knowledge graph from existing wiki pages in .memory/ directory.

**Steps:**
1. Call \`memory-build\` tool to scan all wiki pages and create graph index
2. Show the user the build statistics (nodes, edges, counts by type)
3. If errors occur, explain what went wrong

This command scans all .md files in .memory/modules/, .memory/concepts/, .memory/configs/, and .memory/synthesis/ directories.
`,
  'memory-evolve.md': `---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

**Steps:**
1. Call \`memory-evolve\` tool with the specified action
2. Format the result nicely with emojis and sections

**Available actions:**
- \`status\`: Show evolution engine status (running, watched files, pending changes)
- \`pause\`: Pause automatic updates
- \`resume\`: Resume automatic updates
- \`history\`: Show recent update history

Action: $ARGUMENTS (defaults to "status" if not specified)
`,
  'memory-batch-ingest.md': `---
description: Batch ingest files into the knowledge base with automatic batching
agent: build
---

Batch ingest source files into the knowledge base. This command is designed for processing many files efficiently by splitting them into batches and delegating wiki generation to subagents.

**Workflow:**
1. Call \`memory-batch-ingest\` tool with the file list or directory and batch size
2. The tool returns batches of file context + wiki-generation prompts
3. For each batch, delegate to @wiki-generator sub-agent with the prepared prompt
4. For each wiki page the subagent generates, call \`memory-save-wiki\` to persist it
5. After all batches are processed, call \`memory-build\` to rebuild the knowledge graph

**Arguments:** $ARGUMENTS

Arguments can be:
- A directory path to scan (e.g., "src/")
- A comma-separated list of files (e.g., "src/foo.ts,src/bar.ts")
- A file type filter (e.g., "module", "config")
- Empty (processes all project files)

**Batch size:** Default is 5 files per batch. Specify with "batch:N" (e.g., "src/ batch:10")
`
}

const WIKI_VALIDATOR_AGENT = `---
description: Validates generated wiki pages for completeness, accuracy, and formatting. Compares wiki content against source code to ensure documentation is correct and up-to-date. Read-only access.
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: false
---

You are a wiki validator agent. Your task is to validate generated wiki pages for completeness, accuracy, and formatting.

## Your Workflow

1. **Read the wiki page** - Examine the wiki page content
2. **Read the source code** - Compare against the original source file
3. **Validate the following**:
   - Frontmatter fields are present and correct
   - Overview accurately describes the file
   - Key elements are documented
   - Relationships are correct (depends-on, used-by, implements, part-of)
   - Tags are relevant and appropriate
   - Code examples are accurate
4. **Report issues** - List any problems found with severity levels:
   - **Critical**: Missing frontmatter, incorrect relationships
   - **Warning**: Incomplete documentation, outdated information
   - **Info**: Suggestions for improvement

## Validation Checklist

- [ ] \`name\` field present and unique (kebab-case)
- [ ] \`type\` field correct (module/concept/config/synthesis)
- [ ] \`category\` field appropriate for the module
- [ ] \`tags\` present (3-8 tags, lowercase, kebab-case)
- [ ] \`source\` field points to correct file
- [ ] \`lastModified\` matches source file
- [ ] Overview is accurate and concise
- [ ] All major classes/functions documented
- [ ] Dependency relationships are correct
- [ ] Used-by relationships are correct (if applicable)
- [ ] Code examples are accurate
- [ ] No sensitive data leaked

## Output Format

Provide a validation report with:
- **File**: Wiki page name
- **Status**: PASS / FAIL / NEEDS_IMPROVEMENT
- **Issues**: List of problems found
- **Suggestions**: Recommendations for improvement
`

export async function ensureCommands(projectDir: string): Promise<void> {
  const commandsDir = path.join(projectDir, '.opencode', 'commands')
  const agentsDir = path.join(projectDir, '.opencode', 'agents')

  try {
    await fs.mkdir(commandsDir, { recursive: true })
    await fs.mkdir(agentsDir, { recursive: true })

    for (const [filename, content] of Object.entries(COMMANDS)) {
      const filePath = path.join(commandsDir, filename)

      try {
        await fs.access(filePath)
      } catch {
        await fs.writeFile(filePath, content, 'utf-8')
      }
    }

    const wikiGeneratorPrompt = await loadPrompt('wiki-generator')
    const wikiGeneratorAgent = `---
description: Generates wiki pages from source code files. Reads code files, analyzes structure and functionality, then creates comprehensive markdown documentation in .memory/ directory. Handles one file or a group of related files at a time.
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: false
---

${wikiGeneratorPrompt}`

    const agents: Record<string, string> = {
      'wiki-generator.md': wikiGeneratorAgent,
      'wiki-validator.md': WIKI_VALIDATOR_AGENT,
    }

    for (const [filename, content] of Object.entries(agents)) {
      const filePath = path.join(agentsDir, filename)
      await fs.writeFile(filePath, content, 'utf-8')
    }
  } catch (error) {
    const logger = Logger.getInstance()
    logger.error('Failed to ensure commands', error as Error)
  }
}
