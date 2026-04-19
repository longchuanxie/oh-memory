import { describe, it, expect } from 'bun:test'
import { ContentClassifier } from '../src/core/content-classifier'

describe('ContentClassifier', () => {
  const classifier = new ContentClassifier()
  
  describe('Entity Classification', () => {
    it('should classify TypeScript files as entity', () => {
      const result = classifier.classify(
        '/src/auth/login-service.ts',
        'export class LoginService {\n  async login() {}\n}'
      )
      expect(result.category).toBe('entity')
      expect(result.confidence).toBeGreaterThan(0.5)
    })
    
    it('should classify React components as entity', () => {
      const result = classifier.classify(
        '/src/components/LoginForm.component.tsx',
        'export const LoginForm = () => { return <form></form> }'
      )
      expect(result.category).toBe('entity')
    })
    
    it('should classify Python files as entity', () => {
      const result = classifier.classify(
        '/src/models/user.py',
        'class User:\n    def __init__(self):\n        pass'
      )
      expect(result.category).toBe('entity')
    })
    
    it('should classify service files as entity', () => {
      const result = classifier.classify(
        '/src/services/api.service.ts',
        'export class ApiService {}'
      )
      expect(result.category).toBe('entity')
    })
    
    it('should classify files with imports as entity', () => {
      const result = classifier.classify(
        '/src/utils/helper.ts',
        'import { foo } from "./bar"\nexport const help = () => {}'
      )
      expect(result.category).toBe('entity')
    })
  })
  
  describe('Concept Classification', () => {
    it('should classify architecture docs as concept', () => {
      const result = classifier.classify(
        '/docs/architecture/api-design.md',
        '# API Design\n\nThis document describes the API architecture and design patterns...'
      )
      expect(result.category).toBe('concept')
    })
    
    it('should classify flow diagrams as concept', () => {
      const result = classifier.classify(
        '/docs/flows/authentication-flow.md',
        '# Authentication Flow\n\n```mermaid\ngraph TD\n  A --> B\n```'
      )
      expect(result.category).toBe('concept')
    })
    
    it('should classify tutorial docs as concept', () => {
      const result = classifier.classify(
        '/docs/tutorials/getting-started.md',
        '# Getting Started Tutorial\n\nThis guide will help you...'
      )
      expect(result.category).toBe('concept')
    })
    
    it('should classify design pattern docs as concept', () => {
      const result = classifier.classify(
        '/docs/design-patterns.md',
        '# Design Patterns\n\nWe use the following patterns...'
      )
      expect(result.category).toBe('concept')
    })
  })
  
  describe('Source Classification', () => {
    it('should classify README as source', () => {
      const result = classifier.classify(
        '/README.md',
        '# Project Name\n\nThis is the project README...'
      )
      expect(result.category).toBe('source')
      expect(result.confidence).toBeGreaterThan(0.3)
    })
    
    it('should classify CHANGELOG as source', () => {
      const result = classifier.classify(
        '/CHANGELOG.md',
        '# Changelog\n\n## v1.0.0\n- Initial release'
      )
      expect(result.category).toBe('source')
    })
    
    it('should classify config files as source', () => {
      const result = classifier.classify(
        '/tsconfig.json',
        '{ "compilerOptions": { "target": "ES2020" } }'
      )
      expect(result.category).toBe('source')
    })
    
    it('should classify package.json as source', () => {
      const result = classifier.classify(
        '/package.json',
        '{ "name": "test", "version": "1.0.0" }'
      )
      expect(result.category).toBe('source')
    })
    
    it('should classify docs directory files as source', () => {
      const result = classifier.classify(
        '/docs/notes.md',
        '# Notes\n\nSome documentation notes...'
      )
      expect(result.category).toBe('source')
    })
  })
  
  describe('Synthesis Classification', () => {
    it('should classify ADR documents as synthesis', () => {
      const result = classifier.classify(
        '/docs/adr/ADR-001-database-choice.md',
        '# ADR-001: Database Choice\n\n## Decision\n\nWe chose PostgreSQL...'
      )
      expect(result.category).toBe('synthesis')
    })
    
    it('should classify migration guides as synthesis', () => {
      const result = classifier.classify(
        '/docs/adr/v2-migration-guide.md',
        '# v2 Migration Guide\n\n## Decision\n\nWe decided to migrate...'
      )
      expect(result.category).toBe('synthesis')
    })
    
    it('should classify comparison docs as synthesis', () => {
      const result = classifier.classify(
        '/docs/comparison.md',
        '# Comparison\n\nWe compared the following options...'
      )
      expect(result.category).toBe('synthesis')
    })
    
    it('should classify retrospective docs as synthesis', () => {
      const result = classifier.classify(
        '/docs/retrospective.md',
        '# Retrospective\n\nWhat we learned from this project...'
      )
      expect(result.category).toBe('synthesis')
    })
    
    it('should classify docs with multiple module references as synthesis', () => {
      const result = classifier.classify(
        '/docs/adr/project-overview.md',
        '# Project Overview\n\nRelated: [[auth]], [[database]], [[api]], [[ui]], [[utils]]'
      )
      expect(result.category).toBe('synthesis')
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle empty files', () => {
      const result = classifier.classify('/src/empty.ts', '')
      expect(result.category).toBeDefined()
      expect(['entity', 'concept', 'source', 'synthesis']).toContain(result.category)
    })
    
    it('should provide reasons for classification', () => {
      const result = classifier.classify(
        '/src/user.ts',
        'export class User { }'
      )
      expect(result.reasons.length).toBeGreaterThan(0)
    })
    
    it('should handle unknown extensions', () => {
      const result = classifier.classify(
        '/data/file.xyz',
        'Some content'
      )
      expect(result.category).toBeDefined()
    })
    
    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/that/goes/on/and/on/file.ts'
      const result = classifier.classify(longPath, 'export const x = 1')
      expect(result.category).toBe('entity')
    })
    
    it('should handle special characters in content', () => {
      const result = classifier.classify(
        '/src/parser.ts',
        'export function parse(input: string) {\n  return input.split(/[\\s\\S]/)\n}'
      )
      expect(result.category).toBe('entity')
    })
  })
  
  describe('Confidence Scores', () => {
    it('should have high confidence for clear cases', () => {
      const result = classifier.classify(
        '/README.md',
        '# README\n\nProject documentation'
      )
      expect(result.confidence).toBeGreaterThan(0.3)
    })
    
    it('should have confidence between 0 and 1', () => {
      const result = classifier.classify(
        '/src/file.ts',
        'export const x = 1'
      )
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })
  
  describe('Rule Management', () => {
    it('should allow adding custom rules', () => {
      const customRule = {
        name: 'custom-test-rule',
        category: 'entity' as const,
        weight: 0.5,
        condition: (ctx: any) => ctx.fileName.includes('custom')
      }
      
      classifier.addRule(customRule)
      const rules = classifier.getRules()
      expect(rules.some(r => r.name === 'custom-test-rule')).toBe(true)
      
      classifier.removeRule('custom-test-rule')
    })
    
    it('should allow removing rules', () => {
      const customRule = {
        name: 'temporary-rule',
        category: 'concept' as const,
        weight: 0.5,
        condition: (ctx: any) => false
      }
      
      classifier.addRule(customRule)
      classifier.removeRule('temporary-rule')
      
      const rules = classifier.getRules()
      expect(rules.some(r => r.name === 'temporary-rule')).toBe(false)
    })
  })
})
