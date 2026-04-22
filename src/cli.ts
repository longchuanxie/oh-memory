#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { Logger } from './utils/logger.js'
import { loadPrompt } from './utils/prompt-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COMMANDS = {
  'memory-init.md': `---
description: Initialize the knowledge base for the project
agent: build
---

Initialize the oh-memory knowledge base for this project.

Please use the \`memory-init\` tool to set up the knowledge base structure.

After initialization:
1. Show the user the created directory structure
2. Ask if they want to ingest existing project files
3. If yes, use \`memory-project-snapshot\` to understand scope, then \`memory-ingest\` to process files

Project directory: $ARGUMENTS
`,
  'memory-ingest.md': `---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

**Single-file workflow (<=5 files):**
1. Call \`memory-read-context\` to get file contents as LLM-ready context
2. Use @wiki-generator sub-agent to generate wiki pages
3. Call \`memory-save-wiki\` for each generated wiki page
4. Call \`memory-build\` to rebuild the knowledge graph

**Batch workflow (>5 files):**
1. Call \`memory-batch-ingest\` with the file list and batch size
2. For each batch returned, delegate to @wiki-generator sub-agent with the prepared prompt
3. For each wiki page the subagent generates, call \`memory-save-wiki\` to persist it
4. After all batches are processed, call \`memory-build\` to rebuild the knowledge graph

Files or directories to ingest: $ARGUMENTS

If no files are specified, ask the user which files or directories they want to ingest.
`,
  'memory-query.md': `---
description: Query the knowledge base
agent: build
---

Query the knowledge base with the following question: $ARGUMENTS

Please use the \`memory-query\` tool to search for relevant information.

After querying:
1. Present the answer with citations to source pages
2. Show relevant knowledge pages
3. Ask if the user wants to save this answer as a new synthesis page
`,
  'memory-status.md': `---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

Please use the \`memory-status\` tool to get the following information:
- Graph statistics (nodes, edges)
- Evolution engine status (running, watched files, pending changes)

After receiving the status:

1. Format it nicely using markdown
2. Highlight any issues
3. Suggest actions based on the status:
   - If pending changes > 0: suggest running /memory-ingest
   - If evolution is not running: suggest checking evolution config

Project directory: $ARGUMENTS
`,
  'memory-evolve.md': `---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

Please use the \`memory-evolve\` tool with the specified action: $ARGUMENTS

Available actions:
- status: Show evolution engine status
- pause: Pause automatic updates
- resume: Resume automatic updates
- history: Show recent update history

If no action specified, use "status"
`,
  'memory-build.md': `---
description: Build or rebuild the knowledge graph
agent: build
---

Build or rebuild the knowledge graph from the .memory/ directory.

Please use the \`memory-build\` tool to scan all wiki pages and create the graph index.

This should be called after:
- Ingesting new files
- Creating or updating wiki pages
- Making manual changes to .memory/ directory

After building:
1. Show the graph statistics (nodes, edges, type distribution)
2. Suggest running /memory-query to test the graph
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
`,
}

const OPENCODE_CONFIG = {
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oh-memory"]
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

async function init(): Promise<void> {
  console.log('[oh-memory] Initializing plugin...\n')

  const projectDir = process.cwd()

  try {
    console.log('[oh-memory] Step 1: Creating command files...')
    const commandsDir = path.join(projectDir, '.opencode', 'commands')
    await fs.mkdir(commandsDir, { recursive: true })

    for (const [filename, content] of Object.entries(COMMANDS)) {
      const filePath = path.join(commandsDir, filename)
      await fs.writeFile(filePath, content, 'utf-8')
      console.log(`  Created ${filename}`)
    }
    console.log()

    console.log('[oh-memory] Step 2: Creating agent files...')
    const agentsDir = path.join(projectDir, '.opencode', 'agents')
    await fs.mkdir(agentsDir, { recursive: true })

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
      console.log(`  Created ${filename}`)
    }
    console.log()

    console.log('[oh-memory] Step 3: Configuring OpenCode...')
    const configPath = path.join(projectDir, 'opencode.json')

    try {
      const existingConfig = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(existingConfig)

      if (!config.plugin) {
        config.plugin = []
      }

      if (!config.plugin.includes('oh-memory')) {
        config.plugin.push('oh-memory')
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
        console.log('  Added oh-memory to opencode.json')
      } else {
        console.log('  oh-memory already configured in opencode.json')
      }
    } catch {
      await fs.writeFile(configPath, JSON.stringify(OPENCODE_CONFIG, null, 2), 'utf-8')
      console.log('  Created opencode.json with oh-memory plugin')
    }
    console.log()

    console.log('[oh-memory] Step 4: Updating .gitignore...')
    const gitignorePath = path.join(projectDir, '.gitignore')
    const memoryIgnore = '.memory/'

    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8')
      if (!gitignore.includes(memoryIgnore)) {
        await fs.appendFile(gitignorePath, `\n# Oh-Memory knowledge base\n${memoryIgnore}\n`, 'utf-8')
        console.log('  Added .memory/ to .gitignore')
      } else {
        console.log('  .memory/ already in .gitignore')
      }
    } catch {
      await fs.writeFile(gitignorePath, `# Oh-Memory knowledge base\n${memoryIgnore}\n`, 'utf-8')
      console.log('  Created .gitignore with .memory/')
    }
    console.log()

    console.log('[oh-memory] Plugin initialized successfully!\n')
    console.log('Next steps:')
    console.log('  1. Restart OpenCode to load the plugin')
    console.log('  2. Run /memory-init to create the knowledge base')
    console.log('  3. Run /memory-ingest <files> to ingest your files')
    console.log('  4. Run /memory-build to build the knowledge graph')
    console.log('  5. Run /memory-query <question> to query the knowledge base')

  } catch (error) {
    const logger = Logger.getInstance()
    logger.error('[oh-memory] Initialization failed', error as Error)
    console.error('[oh-memory] Initialization failed:', error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const command = args[0]

if (command === 'init') {
  init()
} else {
  console.log('Oh-Memory - LLM-powered knowledge base plugin for OpenCode\n')
  console.log('Usage:')
  console.log('  oh-memory init    Initialize the plugin in your project')
  console.log()
  process.exit(0)
}
