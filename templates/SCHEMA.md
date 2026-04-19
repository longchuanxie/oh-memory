# Knowledge Base Schema

This document defines the structure and conventions for the knowledge base.

## Page Types

### Entity Pages
- **Location**: `entities/`
- **Purpose**: Document code entities (modules, functions, classes)
- **Required Fields**: title, type, tags, date
- **Optional Fields**: source, description

### Concept Pages
- **Location**: `concepts/`
- **Purpose**: Document architectural concepts, patterns, decisions
- **Required Fields**: title, type, tags, date
- **Optional Fields**: description

### Source Pages
- **Location**: `sources/`
- **Purpose**: Summarize source documents and files
- **Required Fields**: title, type, tags, date, source
- **Optional Fields**: description

### Synthesis Pages
- **Location**: `synthesis/`
- **Purpose**: Comprehensive analyses and cross-cutting topics
- **Required Fields**: title, type, tags, date
- **Optional Fields**: description

## Linking Conventions

Use double bracket syntax for internal links:
- `[[page-name]]` - Link to another page
- `[[page-name|display text]]` - Link with custom text

## Tagging Guidelines

- Use lowercase tags
- Use hyphens for multi-word tags
- Examples: authentication, api-design, database

## Update Workflow

1. Ingest new sources
2. Generate/update knowledge pages
3. Validate links and consistency
4. Update index and graph
5. Log changes
