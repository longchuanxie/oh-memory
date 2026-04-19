import { describe, it, expect } from 'bun:test'
import { PathMapper } from '../src/core/path-mapper'

describe('PathMapper', () => {
  const mapper = new PathMapper()
  
  describe('Path Mapping', () => {
    it('should map component files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/components/auth/LoginForm.tsx',
        'entity'
      )
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toContain('components')
      expect(result.subcategories).toContain('auth')
      expect(result.name).toBe('loginform')
    })
    
    it('should map service files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/services/api/auth.ts',
        'entity'
      )
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toContain('services')
      expect(result.subcategories).toContain('api')
    })
    
    it('should map documentation files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/docs/api-design.md',
        'concept'
      )
      
      expect(result.category).toBe('source')
      expect(result.subcategories).toContain('docs')
    })
    
    it('should map test files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/tests/auth.test.ts',
        'entity'
      )
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toContain('tests')
    })
    
    it('should map config files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/tsconfig.config.json',
        'source'
      )
      
      expect(result.category).toBe('source')
      expect(result.subcategories).toContain('config')
    })
    
    it('should respect max depth limit', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/a/b/c/d/e/f/file.ts',
        'entity'
      )
      
      expect(result.subcategories.length).toBeLessThanOrEqual(4)
    })
    
    it('should handle files without src directory', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/README.md',
        'source'
      )
      
      expect(result.category).toBe('source')
      expect(result.name).toBe('readme')
    })
  })
  
  describe('Path Parsing', () => {
    it('should parse knowledge path correctly', () => {
      const result = mapper.parseKnowledgePath(
        'entity/components/auth/login-form'
      )
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toEqual(['components', 'auth'])
      expect(result.name).toBe('login-form')
    })
    
    it('should parse flat path correctly', () => {
      const result = mapper.parseKnowledgePath('entity/readme')
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toEqual([])
      expect(result.name).toBe('readme')
    })
  })
  
  describe('File Path Generation', () => {
    it('should generate file path with subcategories', () => {
      const knowledgePath = {
        category: 'entity' as const,
        subcategories: ['components', 'auth'],
        name: 'loginform',
        fullPath: 'entity/components/auth/loginform'
      }
      
      const filePath = mapper.generateFilePath(knowledgePath)
      
      expect(filePath).toBe(path.join('entities', 'components', 'auth', 'loginform.md'))
    })
    
    it('should generate flat file path', () => {
      const knowledgePath = {
        category: 'source' as const,
        subcategories: [],
        name: 'readme',
        fullPath: 'source/readme'
      }
      
      const filePath = mapper.generateFilePath(knowledgePath)
      
      expect(filePath).toBe(path.join('sources', 'readme.md'))
    })
  })
  
  describe('Path Validation', () => {
    it('should validate depth correctly', () => {
      const validPath = {
        category: 'entity' as const,
        subcategories: ['a', 'b', 'c'],
        name: 'test',
        fullPath: 'entity/a/b/c/test'
      }
      
      expect(mapper.validateDepth(validPath)).toBe(true)
    })
    
    it('should reject paths exceeding max depth', () => {
      const invalidPath = {
        category: 'entity' as const,
        subcategories: ['a', 'b', 'c', 'd', 'e'],
        name: 'test',
        fullPath: 'entity/a/b/c/d/e/test'
      }
      
      expect(mapper.validateDepth(invalidPath)).toBe(false)
    })
  })
  
  describe('Name Sanitization', () => {
    it('should sanitize names correctly', () => {
      expect(mapper.sanitizeName('LoginForm')).toBe('loginform')
      expect(mapper.sanitizeName('auth-service')).toBe('auth-service')
      expect(mapper.sanitizeName('API_V2')).toBe('api_v2')
      expect(mapper.sanitizeName('test.file')).toBe('test-file')
    })
    
    it('should handle special characters', () => {
      expect(mapper.sanitizeName('file@name')).toBe('file-name')
      expect(mapper.sanitizeName('file   name')).toBe('file-name')
    })
  })
  
  describe('Rule Management', () => {
    it('should allow adding custom rules', () => {
      const customRule = {
        pattern: /\/custom\/(.+)\.ts$/,
        category: 'entity' as const,
        subcategories: ['custom', '$1'],
        priority: 250
      }
      
      mapper.addRule(customRule)
      const rules = mapper.getRules()
      expect(rules.some(r => r.priority === 250)).toBe(true)
      
      mapper.removeRule(customRule.pattern)
    })
    
    it('should allow removing rules', () => {
      const customRule = {
        pattern: /\/temporary\/(.+)\.ts$/,
        category: 'entity' as const,
        subcategories: ['temp'],
        priority: 300
      }
      
      mapper.addRule(customRule)
      mapper.removeRule(customRule.pattern)
      
      const rules = mapper.getRules()
      expect(rules.some(r => r.priority === 300)).toBe(false)
    })
    
    it('should sort rules by priority', () => {
      const rule1 = {
        pattern: /\/rule1\/.+/,
        category: 'entity' as const,
        subcategories: ['rule1'],
        priority: 100
      }
      
      const rule2 = {
        pattern: /\/rule2\/.+/,
        category: 'entity' as const,
        subcategories: ['rule2'],
        priority: 200
      }
      
      mapper.addRule(rule1)
      mapper.addRule(rule2)
      
      const rules = mapper.getRules()
      const rule1Index = rules.findIndex(r => r.priority === 100)
      const rule2Index = rules.findIndex(r => r.priority === 200)
      
      expect(rule2Index).toBeLessThan(rule1Index)
      
      mapper.removeRule(rule1.pattern)
      mapper.removeRule(rule2.pattern)
    })
  })
  
  describe('Max Depth Configuration', () => {
    it('should allow setting max depth', () => {
      mapper.setMaxDepth(3)
      expect(mapper.getMaxDepth()).toBe(3)
      
      mapper.setMaxDepth(5)
      expect(mapper.getMaxDepth()).toBe(5)
    })
    
    it('should enforce min and max limits', () => {
      mapper.setMaxDepth(0)
      expect(mapper.getMaxDepth()).toBe(1)
      
      mapper.setMaxDepth(15)
      expect(mapper.getMaxDepth()).toBe(10)
      
      mapper.setMaxDepth(5)
    })
  })
})

import path from 'path'
