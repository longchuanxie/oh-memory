import { describe, it, expect, beforeEach } from 'bun:test'
import { ContentSearcher } from '../src/core/content-searcher'
import type { PageData } from '../src/types'

describe('ContentSearcher', () => {
  let searcher: ContentSearcher
  let pages: PageData[]

  beforeEach(() => {
    searcher = new ContentSearcher()
    pages = [
      {
        id: 'auth-service',
        metadata: {
          id: 'auth-service',
          title: 'Authentication Service',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['auth', 'security'],
          category: 'entities'
        },
        content: `# Authentication Service

This service handles user authentication and authorization.

## Features
- JWT token generation
- Password hashing
- Session management

## Usage
\`\`\`typescript
const auth = new AuthService()
const token = auth.login(username, password)
\`\`\`

The authentication flow validates credentials against the database.`,
        links: []
      },
      {
        id: 'user-model',
        metadata: {
          id: 'user-model',
          title: 'User Model',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['user', 'model'],
          category: 'entities'
        },
        content: `# User Model

Defines the user data structure.

## Properties
- id: string
- username: string
- email: string
- password: string (hashed)

## Relations
- has many Sessions
- belongs to Role`,
        links: []
      },
      {
        id: 'api-design',
        metadata: {
          id: 'api-design',
          title: 'API Design Guide',
          type: 'concept',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['api', 'design'],
          category: 'concepts'
        },
        content: `# API Design Guide

Best practices for REST API design.

## Principles
1. Use nouns for resources
2. Use HTTP methods correctly
3. Version your APIs

## Authentication
All APIs require authentication via JWT tokens.`,
        links: []
      }
    ]
  })

  describe('searchContent', () => {
    it('should find matches across multiple pages', async () => {
      const results = await searcher.searchContent(pages, 'authentication', { limit: 10 })

      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.pageId === 'auth-service')).toBe(true)
      expect(results.some(r => r.pageId === 'api-design')).toBe(true)
    })

    it('should respect limit option', async () => {
      const results = await searcher.searchContent(pages, 'authentication', { limit: 1 })

      expect(results.length).toBe(1)
    })

    it('should return empty array for no matches', async () => {
      const results = await searcher.searchContent(pages, 'nonexistent-term-xyz', { limit: 10 })

      expect(results).toHaveLength(0)
    })

    it('should handle empty query', async () => {
      const results = await searcher.searchContent(pages, '', { limit: 10 })

      expect(results).toHaveLength(0)
    })

    it('should handle empty pages array', async () => {
      const results = await searcher.searchContent([], 'authentication', { limit: 10 })

      expect(results).toHaveLength(0)
    })

    it('should respect contextLines option', async () => {
      const results = await searcher.searchContent(pages, 'authentication', {
        limit: 10,
        contextLines: 1
      })

      expect(results.length).toBeGreaterThan(0)
      // 验证context不包含过多行
      for (const result of results) {
        for (const match of result.matches) {
          const lineCount = match.context.split('\n').length
          expect(lineCount).toBeLessThanOrEqual(3) // 1行上下文 + 1行匹配
        }
      }
    })

    it('should handle case sensitivity option', async () => {
      const caseSensitiveResults = await searcher.searchContent(pages, 'Authentication', {
        limit: 10,
        caseSensitive: true
      })

      const caseInsensitiveResults = await searcher.searchContent(pages, 'Authentication', {
        limit: 10,
        caseSensitive: false
      })

      // 不区分大小写应该找到更多结果
      expect(caseInsensitiveResults.length).toBeGreaterThanOrEqual(caseSensitiveResults.length)
    })

    it('should sort results by match count', async () => {
      const results = await searcher.searchContent(pages, 'authentication', { limit: 10 })

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].matches.length).toBeGreaterThanOrEqual(results[i + 1].matches.length)
      }
    })

    it('should include page metadata in results', async () => {
      const results = await searcher.searchContent(pages, 'authentication', { limit: 10 })

      for (const result of results) {
        expect(result.title).toBeDefined()
        expect(result.category).toBeDefined()
        expect(result.tags).toBeDefined()
      }
    })
  })

  describe('findMatchesInContent', () => {
    it('should find all occurrences of query term', () => {
      const content = `Line 1: authentication
Line 2: other content
Line 3: Authentication again
Line 4: more text
Line 5: AUTHENTICATION`

      const matches = searcher.findMatchesInContent(content, 'authentication', 2, false)

      // 不区分大小写应该找到3个匹配
      expect(matches.length).toBe(3)
    })

    it('should respect case sensitivity', () => {
      const content = `Line 1: authentication
Line 2: Authentication
Line 3: AUTHENTICATION`

      const caseSensitiveMatches = searcher.findMatchesInContent(content, 'Authentication', 2, true)
      const caseInsensitiveMatches = searcher.findMatchesInContent(content, 'Authentication', 2, false)

      expect(caseSensitiveMatches.length).toBe(1)
      expect(caseInsensitiveMatches.length).toBe(3)
    })

    it('should include context lines around match', () => {
      const content = `Line 1
Line 2
Line 3: target word here
Line 4
Line 5`

      const matches = searcher.findMatchesInContent(content, 'target', 2, false)

      expect(matches.length).toBe(1)
      expect(matches[0].context).toContain('Line 1')
      expect(matches[0].context).toContain('Line 5')
    })

    it('should handle matches at start of content', () => {
      const content = `target word at start
Line 2
Line 3`

      const matches = searcher.findMatchesInContent(content, 'target', 2, false)

      expect(matches.length).toBe(1)
      expect(matches[0].lineNumber).toBe(1)
    })

    it('should handle matches at end of content', () => {
      const content = `Line 1
Line 2
target word at end`

      const matches = searcher.findMatchesInContent(content, 'target', 2, false)

      expect(matches.length).toBe(1)
      expect(matches[0].lineNumber).toBe(3)
    })

    it('should return empty array for no matches', () => {
      const content = `Line 1
Line 2
Line 3`

      const matches = searcher.findMatchesInContent(content, 'nonexistent', 2, false)

      expect(matches).toHaveLength(0)
    })

    it('should handle empty content', () => {
      const matches = searcher.findMatchesInContent('', 'target', 2, false)

      expect(matches).toHaveLength(0)
    })

    it('should handle empty query', () => {
      const content = `Line 1
Line 2`

      const matches = searcher.findMatchesInContent(content, '', 2, false)

      expect(matches).toHaveLength(0)
    })

    it('should limit matches per term', () => {
      const lines = []
      for (let i = 1; i <= 20; i++) {
        lines.push(`Line ${i}: authentication`)
      }
      const content = lines.join('\n')

      const matches = searcher.findMatchesInContent(content, 'authentication', 2, false)

      // 应该限制每个term最多5个匹配
      expect(matches.length).toBeLessThanOrEqual(5)
    })

    it('should include correct line number', () => {
      const content = `Line 1
Line 2
Line 3: target word
Line 4`

      const matches = searcher.findMatchesInContent(content, 'target', 2, false)

      expect(matches[0].lineNumber).toBe(3)
    })

    it('should truncate long context', () => {
      const longLine = 'A'.repeat(500)
      const content = `${longLine}
target word
${longLine}`

      const matches = searcher.findMatchesInContent(content, 'target', 2, false, 100)

      expect(matches.length).toBe(1)
      expect(matches[0].context.length).toBeLessThanOrEqual(103) // 100 + '...'
    })
  })
})
