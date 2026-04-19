# Oh-Memory

LLM-powered knowledge base plugin for OpenCode, based on the llm-wiki design philosophy.

## Overview

Oh-Memory transforms your project's code and documentation into a structured, interlinked knowledge base that grows and evolves with your project. It provides intelligent knowledge management capabilities through automatic ingestion, validation, and evolution.

## Features

- **Automatic Knowledge Ingestion**: Transform source files into structured wiki pages
- **Graph-Based Navigation**: Visualize knowledge connections with interactive graphs
- **Intelligent Querying**: Natural language queries across your knowledge base
- **Auto-Evolution**: Monitor file changes and automatically update knowledge
- **Multi-Layer Validation**: Format, link, and content validation with auto-fix
- **Human-Friendly Review**: Visual diff and approval workflow
- **Easy Setup**: One-command initialization with `oh-memory init`

## Installation

### From NPM

```bash
npm install oh-memory
```

### Quick Start

Get started in 3 simple steps:

#### Step 1: Install

```bash
# Navigate to your project directory
cd your-project

# Install oh-memory
npm install oh-memory
```

#### Step 2: Initialize

```bash
# Initialize oh-memory (creates commands and configuration)
npx oh-memory init
```

This will:
- ✅ Create `.opencode/commands/` directory with all memory-* commands
- ✅ Create or update `opencode.json` with the plugin configuration
- ✅ Add `.memory/` to `.gitignore`

#### Step 3: Build Your Knowledge Base

```bash
# Initialize the knowledge base structure
/memory-init

# Ingest your source files
/memory-ingest src/

# Query your knowledge base
/memory-query How does the authentication system work?
```

### That's it! 🎉

Your knowledge base is now ready. The `.memory/` directory contains:
- Structured wiki pages for your code
- Interactive knowledge graph (`.memory/graph.html`)
- Searchable index for queries

### Manual Configuration (Alternative)

If you prefer manual setup:

1. Add to your `opencode.json`:

```json
{
  "plugin": ["oh-memory"]
}
```

2. Restart OpenCode - the plugin will automatically create the command files.

## Commands

After installation, the following commands will be available in OpenCode:

### `/memory-init`

Initialize the knowledge base for your project.

```bash
/memory-init
```

This creates the `.memory/` directory structure with:
- `entities/` - Code entities (modules, functions, classes)
- `concepts/` - Architectural concepts and patterns
- `sources/` - Source document summaries
- `synthesis/` - Cross-cutting analyses
- `index.md` - Knowledge base index
- `log.md` - Operation log
- `SCHEMA.md` - Configuration schema
- `graph.json` - Graph index
- `graph.html` - Visual graph

### `/memory-ingest`

Ingest source files into the knowledge base.

```bash
/memory-ingest src/
/memory-ingest README.md
/memory-ingest docs/
```

**Git Version Control (IMPORTANT)**:
- By default, only files tracked by git are processed
- Untracked files are automatically skipped for security
- To include untracked files, use `includeUntracked: true` option
- This prevents accidental ingestion of sensitive or temporary files

**Smart Filtering**: The command automatically filters out:
- Compiled files (`.class`, `.jar`, `.pyc`, `.exe`, `.dll`, etc.)
- Dependencies (`node_modules/`, `vendor/`, `Pods/`, etc.)
- Build outputs (`dist/`, `build/`, `target/`, `out/`, etc.)
- Lock files (`package-lock.json`, `yarn.lock`, etc.)
- Environment files (`.env`, `.env.local`, etc.)
- Minified files (`.min.js`, `.min.css`, etc.)

See [FILTER_RULES.md](FILTER_RULES.md) for complete filtering rules.
See [GIT_INTEGRATION.md](GIT_INTEGRATION.md) for Git version control details.

### `/memory-query`

Query the knowledge base with natural language.

```bash
/memory-query How does authentication work?
/memory-query What are the main components?
```

### `/memory-lint`

Validate and repair the knowledge base.

```bash
/memory-lint
/memory-lint --auto-fix
```

## Architecture

Oh-Memory follows a three-layer architecture:

1. **Project Files** - Your existing code and documentation (read-only)
2. **Knowledge Wiki** - LLM-generated structured knowledge (`.memory/`)
3. **Schema** - Configuration and conventions (`.memory/SCHEMA.md`)

## Graph Index

The plugin uses Markdown double-bracket links for knowledge graph construction:

- `[[page-name]]` - Link to another page
- `[[page-name|display text]]` - Link with custom text

The graph is automatically built and can be visualized in `.memory/graph.html`.

## Auto-Evolution

Oh-Memory can automatically monitor your project files and update the knowledge base:

```json
{
  "autoEvolution": {
    "enabled": true,
    "watchPatterns": ["src/**/*.ts", "docs/**/*.md"],
    "ignorePatterns": ["**/*.test.ts", "**/node_modules/**"],
    "updateThreshold": 10,
    "requireApproval": true
  }
}
```

## Validation

The plugin provides multi-layer validation:

1. **Format Validation** - JSON Schema for frontmatter
2. **Link Validation** - Broken links and orphan pages
3. **Content Validation** - Contradictions and inconsistencies
4. **Human Review** - Approval workflow for LLM-generated content

## Usage Workflow

### Typical Workflow

```bash
# 1. Initialize the knowledge base (first time only)
/memory-init

# 2. Ingest your source files
/memory-ingest src/
/memory-ingest docs/

# 3. Query the knowledge base
/memory-query How does the authentication system work?

# 4. Validate and repair (optional)
/memory-lint --auto-fix
```

### Tips

- **Incremental Updates**: Re-run `/memory-ingest` when you add new files
- **Git Integration**: Only git-tracked files are processed by default
- **Auto-Evolution**: Enable in config to auto-update on file changes
- **Visual Graph**: Open `.memory/graph.html` to explore connections

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Publish

```bash
# Publish beta version
npm run publish:beta

# Publish stable version
npm run publish:stable
```

## Troubleshooting

### Commands not showing up?

1. Make sure the plugin is installed: `npm list oh-memory`
2. Check `opencode.json` includes the plugin
3. Restart OpenCode
4. Check if `.opencode/commands/` directory exists with the command files
5. Try running `npx oh-memory init` to manually initialize

### Plugin not loading?

1. Check the plugin is correctly listed in `opencode.json`
2. Verify npm package is installed
3. Check OpenCode logs for errors

### Knowledge base not initializing?

1. Ensure you have write permissions in the project directory
2. Check if `.memory/` directory already exists
3. Try removing `.memory/` and running `/memory-init` again

### CLI command not found?

1. Make sure you're in a project directory
2. Try using `npx oh-memory init`
3. Check if the package is installed globally or locally

## Changelog

### v1.0.0-beta.6 (2026-04-19)
- 🏗️ **Architecture**: Major refactoring with extracted components
  - GraphBuilder, IndexManager, QueryEngine for graph operations
  - ContentExtractor, ContentSearcher for content analysis
  - DocGenerator for documentation generation
  - PageProcessor for file processing
  - CacheCoordinator for cache management
  - GraphIndexBuilder for graph index building
- 🧪 **Testing**: Test coverage increased from ~10% to >70% (582 tests)
- 📝 **Logging**: Structured logging system with multiple log levels
- 🔧 **Config**: Unified configuration management system
- 🛡️ **Error Handling**: Unified error handling with severity levels
- 🔒 **Type Safety**: Eliminated all `any` types in core modules

### v1.0.0-beta.3 (2026-04-18)
- 🐛 **Fixed**: Entity path spelling error (`entitys` → `entities`)
- 🔒 **Security**: Git version control integration (only track tracked files by default)
- 🚫 **Filtering**: Smart file filtering (exclude compiled files, dependencies, etc.)
- 🛠️ **CLI**: Added `oh-memory init` command for easy setup

### v1.0.0-beta.2 (2026-04-18)
- ✨ Initial beta release
- 📚 Knowledge base management
- 🔍 Query and search functionality
- ✅ Validation and auto-fix

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Credits

Based on the [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) design philosophy by Andrej Karpathy.
