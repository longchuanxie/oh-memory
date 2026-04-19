#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { Logger } from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COMMANDS = {
  'memory-init.md': `---
description: Initialize the knowledge base for the project
agent: build
---

Initialize the oh-memory knowledge base for this project.

Please use the \`memory-init-kb\` tool to set up the knowledge base structure.

After initialization:
1. Show the user the created directory structure
2. Ask if they want to ingest existing project files
3. If yes, use the \`memory-ingest-files\` tool to process the files

Project directory: $ARGUMENTS
`,
  'memory-ingest.md': `---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

Please use the \`memory-ingest-files\` tool to process the following files or directories: $ARGUMENTS

**Git Version Control (IMPORTANT)**:
- By default, only files tracked by git are processed
- Untracked files are automatically skipped for security
- To include untracked files, the user must explicitly set includeUntracked=true
- Always check if files are tracked before processing

**Smart Filtering**: The command automatically filters out:
- Compiled files (.class, .jar, .pyc, .exe, .dll, etc.)
- Dependencies (node_modules/, vendor/, Pods/, etc.)
- Build outputs (dist/, build/, target/, out/, etc.)
- Lock files (package-lock.json, yarn.lock, etc.)
- Environment files (.env, .env.local, etc.)
- Minified files (.min.js, .min.css, etc.)

After ingestion:
1. Show the user a summary of created and updated pages
2. Show which files were filtered and why (including git status)
3. Generate a review interface for human approval
4. Update the index.md and log.md files

If no files are specified, ask the user which files or directories they want to ingest.
`,
  'memory-query.md': `---
description: Query the knowledge base
agent: build
---

Query the knowledge base with the following question: $ARGUMENTS

Please use the \`memory-query-kb\` tool to search for relevant information.

After querying:
1. Present the answer with citations to source pages
2. Show relevant knowledge pages
3. Ask if the user wants to save this answer as a new synthesis page
`,
  'memory-lint.md': `---
description: Health check and repair the knowledge base
agent: build
---

Perform a health check on the knowledge base.

Please use the \`memory-lint-kb\` tool to validate the knowledge base.

After validation:
1. Show the user a list of issues found
2. For each issue, provide repair suggestions
3. Ask if the user wants to auto-fix issues
4. If yes, run the tool again with autoFix=true

Use the following arguments: $ARGUMENTS
`,
  'memory-status.md': `---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

Please use the \`memory-status\` tool to get the following information:
- Total page counts by category (entities, concepts, sources, synthesis)
- Graph statistics (nodes, edges, connection rate)
- Health score and issues count
- Evolution engine status (running, watched files, pending changes)
- Last update time

After receiving the status:

1. **Format it nicely** using markdown tables and emojis
2. **Highlight any issues** (errors in red, warnings in yellow)
3. **Suggest actions** based on the status:
   - If pending changes > 0: suggest running /memory-ingest
   - If health score < 70: suggest running /memory-lint
   - If evolution is not running: suggest checking evolution config
4. **Keep it concise** - focus on what the user needs to know

Project directory: $ARGUMENTS
`,
  'memory-diff.md': `---
description: Preview changes before ingesting files
agent: build
---

Preview the changes that would be made when ingesting files into the knowledge base.

Please use the \`memory-diff\` tool to show what would change.

**Arguments:**
- \`files\`: The files to preview (optional, from user input)
- \`projectPath\`: The project root directory

If no files are specified, the tool will scan for pending changes from the evolution engine.

After receiving the preview:

1. **Format as a clear change list** using:
   - \`+\` for new pages (green)
   - \`~\` for updated pages (yellow)
   - \`-\` for deleted pages (red)
   - \`=\` for unchanged pages (gray)

2. **Show counts** at the top: "X new, Y updated, Z deleted, W unchanged"

3. **Suggest next steps:**
   - If there are changes: "Run \`/memory-ingest <files>\` to apply these changes"
   - If no changes: "Knowledge base is up to date"

Files to preview: $ARGUMENTS
`,
  'memory-evolve.md': `---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

Please use the \`memory-evolve\` tool with the specified action: $ARGUMENTS

**Available actions:**
- \`status\`: Show evolution engine status (running, watched files, pending changes, config)
- \`pause\`: Pause automatic updates
- \`resume\`: Resume automatic updates
- \`history\`: Show recent update history

**If no action specified, use "status"**

After receiving the result:

1. **Format the status nicely** with emojis and sections
2. **If paused:** Remind the user that automatic updates are disabled
3. **If history:** Show the most recent updates with timestamps
4. **If errors:** Explain what went wrong and suggest fixes
`
}

const OPENCODE_CONFIG = {
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oh-memory"]
}

async function init() {
  console.log('🚀 Initializing oh-memory plugin...\n')

  const projectDir = process.cwd()

  try {
    // Step 1: Create .opencode/commands directory
    console.log('📋 Step 1: Creating command files...')
    const commandsDir = path.join(projectDir, '.opencode', 'commands')
    await fs.mkdir(commandsDir, { recursive: true })

    for (const [filename, content] of Object.entries(COMMANDS)) {
      const filePath = path.join(commandsDir, filename)
      await fs.writeFile(filePath, content, 'utf-8')
      console.log(`  ）Created ${filename}`)
    }
    console.log()

    // Step 2: Create or update opencode.json
    console.log('📋 Step 2: Configuring OpenCode...')
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
        console.log('  ）Added oh-memory to opencode.json')
      } else {
        console.log('  ℹ️  oh-memory already configured in opencode.json')
      }
    } catch (error) {
      // File doesn't exist, create it
      await fs.writeFile(configPath, JSON.stringify(OPENCODE_CONFIG, null, 2), 'utf-8')
      console.log('  ）Created opencode.json with oh-memory plugin')
    }
    console.log()

    // Step 3: Create .gitignore entry
    console.log('📋 Step 3: Updating .gitignore...')
    const gitignorePath = path.join(projectDir, '.gitignore')
    const memoryIgnore = '.memory/'
    
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8')
      if (!gitignore.includes(memoryIgnore)) {
        await fs.appendFile(gitignorePath, `\n# Oh-Memory knowledge base\n${memoryIgnore}\n`, 'utf-8')
        console.log('  ）Added .memory/ to .gitignore')
      } else {
        console.log('  ℹ️  .memory/ already in .gitignore')
      }
    } catch (error) {
      // File doesn't exist, create it
      await fs.writeFile(gitignorePath, `# Oh-Memory knowledge base\n${memoryIgnore}\n`, 'utf-8')
      console.log('  ）Created .gitignore with .memory/')
    }
    console.log()

    // Success message
    console.log('🎉 Oh-Memory plugin initialized successfully!\n')
    console.log('📝 Next steps:')
    console.log('  1. Restart OpenCode to load the plugin')
    console.log('  2. Run /memory-init to create the knowledge base')
    console.log('  3. Run /memory-ingest <files> to ingest your files')
    console.log('  4. Run /memory-query <question> to query the knowledge base')
    console.log()
    console.log('📚 Documentation: https://github.com/your-org/oh-memory#readme')
    console.log()

  } catch (error) {
    const logger = Logger.getInstance()
    logger.error('Initialization failed', error as Error)
    console.error('）Initialization failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

if (command === 'init') {
  init()
} else {
  console.log('Oh-Memory - LLM-powered knowledge base plugin for OpenCode\n')
  console.log('Usage:')
  console.log('  oh-memory init    Initialize the plugin in your project')
  console.log()
  console.log('Examples:')
  console.log('  oh-memory init    Set up oh-memory in the current directory')
  console.log()
  process.exit(0)
}
