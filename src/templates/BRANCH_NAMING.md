# AI Session Branch Naming Convention

## Format
```
ai/<channel>/<YYYY-MM-DD>-<topic>
```

## Examples
```
ai/main/2026-04-23-feature-auth
ai/feature/2026-04-24-wiki-builder
ai/fix/2026-04-25-index-bug
```

## Rules
1. All AI session branches MUST start with `ai/`
2. The `<channel>` segment corresponds to the channel name in BOOT.md and session frontmatter
3. The date segment uses ISO 8601 format (YYYY-MM-DD)
4. The topic segment uses lowercase-hyphen format
5. When an AI agent starts work on a new feature/fix, it SHOULD create a branch following this convention
6. The branch name is automatically used as the default channel name
7. After session completion, the branch may be merged and deleted, or kept for reference

## Channel-Branch Relationship
- Channel = git branch name (default)
- Custom channels can be set in BOOT.md's `channel` field
- Sessions are grouped by channel in SESSIONS/INDEX.md
