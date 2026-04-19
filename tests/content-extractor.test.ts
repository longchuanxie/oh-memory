import { describe, it, expect } from 'bun:test'
import { ContentExtractor } from '../src/core/content-extractor'

describe('ContentExtractor', () => {
  const extractor = new ContentExtractor()

  describe('calculateHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'test content'
      const hash1 = extractor.calculateHash(content)
      const hash2 = extractor.calculateHash(content)
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different content', () => {
      const hash1 = extractor.calculateHash('content 1')
      const hash2 = extractor.calculateHash('content 2')
      expect(hash1).not.toBe(hash2)
    })

    it('should return 16 character hash', () => {
      const hash = extractor.calculateHash('test')
      expect(hash.length).toBe(16)
    })

    it('should handle empty content', () => {
      const hash = extractor.calculateHash('')
      expect(hash).toBeDefined()
      expect(hash.length).toBe(16)
    })

    it('should handle special characters', () => {
      const hash = extractor.calculateHash('特殊字符 !@#$%^&*()')
      expect(hash).toBeDefined()
      expect(hash.length).toBe(16)
    })

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000)
      const hash = extractor.calculateHash(longContent)
      expect(hash).toBeDefined()
      expect(hash.length).toBe(16)
    })
  })

  describe('getLanguage', () => {
    it('should return typescript for .ts extension', () => {
      expect(extractor.getLanguage('.ts')).toBe('typescript')
    })

    it('should return typescript for .tsx extension', () => {
      expect(extractor.getLanguage('.tsx')).toBe('typescript')
    })

    it('should return javascript for .js extension', () => {
      expect(extractor.getLanguage('.js')).toBe('javascript')
    })

    it('should return javascript for .jsx extension', () => {
      expect(extractor.getLanguage('.jsx')).toBe('javascript')
    })

    it('should return python for .py extension', () => {
      expect(extractor.getLanguage('.py')).toBe('python')
    })

    it('should return markdown for .md extension', () => {
      expect(extractor.getLanguage('.md')).toBe('markdown')
    })

    it('should return json for .json extension', () => {
      expect(extractor.getLanguage('.json')).toBe('json')
    })

    it('should return yaml for .yaml extension', () => {
      expect(extractor.getLanguage('.yaml')).toBe('yaml')
    })

    it('should return yaml for .yml extension', () => {
      expect(extractor.getLanguage('.yml')).toBe('yaml')
    })

    it('should return text for unknown extension', () => {
      expect(extractor.getLanguage('.xyz')).toBe('text')
    })

    it('should return text for empty extension', () => {
      expect(extractor.getLanguage('')).toBe('text')
    })

    it('should handle various language extensions', () => {
      expect(extractor.getLanguage('.java')).toBe('java')
      expect(extractor.getLanguage('.go')).toBe('go')
      expect(extractor.getLanguage('.rs')).toBe('rust')
      expect(extractor.getLanguage('.rb')).toBe('ruby')
      expect(extractor.getLanguage('.sh')).toBe('shell')
      expect(extractor.getLanguage('.sql')).toBe('sql')
    })

    it('should handle frontend extensions', () => {
      expect(extractor.getLanguage('.vue')).toBe('vue')
      expect(extractor.getLanguage('.svelte')).toBe('svelte')
      expect(extractor.getLanguage('.css')).toBe('css')
      expect(extractor.getLanguage('.scss')).toBe('scss')
      expect(extractor.getLanguage('.html')).toBe('html')
    })
  })

  describe('extractKeywords', () => {
    it('should extract TypeScript keywords', () => {
      const content = 'class Foo { } interface Bar { } type Baz = string'
      const keywords = extractor.extractKeywords(content, '.ts')
      expect(keywords).toContain('class')
      expect(keywords).toContain('interface')
      expect(keywords).toContain('type')
    })

    it('should extract JavaScript keywords', () => {
      const content = 'function foo() { const x = 1; let y = 2; }'
      const keywords = extractor.extractKeywords(content, '.js')
      expect(keywords).toContain('function')
      expect(keywords).toContain('const')
      expect(keywords).toContain('let')
    })

    it('should extract Python keywords', () => {
      const content = 'class Foo:\n    def bar(self):\n        pass'
      const keywords = extractor.extractKeywords(content, '.py')
      expect(keywords).toContain('class')
      expect(keywords).toContain('def')
    })

    it('should extract Go keywords', () => {
      const content = 'package main\n\nfunc main() { }\ntype Foo struct { }'
      const keywords = extractor.extractKeywords(content, '.go')
      expect(keywords).toContain('func')
      expect(keywords).toContain('type')
      expect(keywords).toContain('struct')
    })

    it('should return empty array for unknown extension', () => {
      const keywords = extractor.extractKeywords('some content', '.xyz')
      expect(keywords).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const keywords = extractor.extractKeywords('', '.ts')
      expect(keywords).toEqual([])
    })

    it('should limit to 10 keywords', () => {
      const content = 'class interface type enum function const let var import export async await'
      const keywords = extractor.extractKeywords(content, '.ts')
      expect(keywords.length).toBeLessThanOrEqual(10)
    })

    it('should deduplicate keywords', () => {
      const content = 'class A { } class B { } class C { }'
      const keywords = extractor.extractKeywords(content, '.ts')
      const classCount = keywords.filter(k => k === 'class').length
      expect(classCount).toBe(1)
    })

    it('should convert keywords to lowercase', () => {
      const content = 'CLASS Foo { } INTERFACE Bar { }'
      const keywords = extractor.extractKeywords(content, '.ts')
      expect(keywords).toContain('class')
      expect(keywords).toContain('interface')
    })
  })

  describe('extractKeyFunctions', () => {
    it('should extract TypeScript function declarations', () => {
      const content = 'function foo() { } function bar() { }'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeDefined()
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract TypeScript arrow functions', () => {
      const content = 'const foo = () => { };\nconst bar = async () => { }'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeDefined()
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract Python functions', () => {
      const content = 'def foo():\n    pass\n\ndef bar():\n    pass'
      const functions = extractor.extractKeyFunctions(content, '.py')
      expect(functions).toBeDefined()
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract Go functions', () => {
      const content = 'func foo() { }\nfunc (t *Type) bar() { }'
      const functions = extractor.extractKeyFunctions(content, '.go')
      expect(functions).toBeDefined()
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should filter out private functions starting with underscore', () => {
      const content = 'function _private() { }\nfunction public() { }'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeDefined()
      expect(functions).not.toContain('_private')
      expect(functions).toContain('public')
    })

    it('should return undefined for no functions', () => {
      const content = 'const x = 1'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeUndefined()
    })

    it('should return undefined for unknown extension', () => {
      const functions = extractor.extractKeyFunctions('function foo() { }', '.xyz')
      expect(functions).toBeUndefined()
    })

    it('should limit to 10 functions', () => {
      let content = ''
      for (let i = 0; i < 20; i++) {
        content += `function func${i}() { }\n`
      }
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeDefined()
      expect(functions!.length).toBeLessThanOrEqual(10)
    })

    it('should handle empty content', () => {
      const functions = extractor.extractKeyFunctions('', '.ts')
      expect(functions).toBeUndefined()
    })
  })

  describe('extractDependencies', () => {
    it('should extract TypeScript imports', () => {
      const content = 'import { foo } from "bar"\nimport * as baz from "qux"'
      const deps = extractor.extractDependencies(content, '.ts')
      expect(deps).toContain('bar')
      expect(deps).toContain('qux')
    })

    it('should filter out relative imports', () => {
      const content = 'import { foo } from "./local"\nimport { bar } from "external"'
      const deps = extractor.extractDependencies(content, '.ts')
      expect(deps).not.toContain('./local')
      expect(deps).toContain('external')
    })

    it('should extract Python imports', () => {
      const content = 'import os\nimport sys\nfrom pathlib import Path'
      const deps = extractor.extractDependencies(content, '.py')
      expect(deps).toContain('os')
      expect(deps).toContain('sys')
      expect(deps).toContain('pathlib')
    })

    it('should extract Go imports', () => {
      const content = 'import "fmt"\nimport "github.com/pkg/errors"'
      const deps = extractor.extractDependencies(content, '.go')
      expect(deps).toContain('fmt')
      expect(deps).toContain('github.com/pkg/errors')
    })

    it('should return empty array for unknown extension', () => {
      const deps = extractor.extractDependencies('import foo', '.xyz')
      expect(deps).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const deps = extractor.extractDependencies('', '.ts')
      expect(deps).toEqual([])
    })

    it('should deduplicate dependencies', () => {
      const content = 'import { a } from "lodash"\nimport { b } from "lodash"'
      const deps = extractor.extractDependencies(content, '.ts')
      const lodashCount = deps.filter(d => d === 'lodash').length
      expect(lodashCount).toBe(1)
    })

    it('should limit to 20 dependencies', () => {
      let content = ''
      for (let i = 0; i < 30; i++) {
        content += `import { mod${i} } from "module${i}"\n`
      }
      const deps = extractor.extractDependencies(content, '.ts')
      expect(deps.length).toBeLessThanOrEqual(20)
    })
  })

  describe('determineImportance', () => {
    it('should return critical for large files with exports and tests', () => {
      const lines = 'export const x = 1\n'.repeat(600)
      const content = lines + 'describe("test", () => { it("works", () => {}) })'
      const importance = extractor.determineImportance(content, '.ts')
      expect(importance).toBe('critical')
    })

    it('should return high for files with exports, tests and docs', () => {
      // 250 lines + exports (1) + tests (1) + docs (1) + lines>200 (1) = 4 = critical
      // Need fewer lines to get high: 150 lines + exports (1) + tests (1) + docs (1) = 3 = high
      const content = '/**\n * Doc\n */\n' + 'export const x = 1\n'.repeat(150) +
        'describe("test", () => { it("works", () => {}) })'
      const importance = extractor.determineImportance(content, '.ts')
      expect(importance).toBe('high')
    })

    it('should return medium for moderate files with exports', () => {
      const content = 'export const x = 1\n'.repeat(250)
      const importance = extractor.determineImportance(content, '.ts')
      expect(importance).toBe('medium')
    })

    it('should return low for small files', () => {
      const content = 'const x = 1'
      const importance = extractor.determineImportance(content, '.ts')
      expect(importance).toBe('low')
    })

    it('should consider documentation', () => {
      const content = '/**\n * Documentation\n */\nexport const x = 1'
      const importance = extractor.determineImportance(content, '.ts')
      expect(['medium', 'high', 'critical']).toContain(importance)
    })

    it('should handle empty content', () => {
      const importance = extractor.determineImportance('', '.ts')
      expect(['low', 'medium', 'high', 'critical']).toContain(importance)
    })

    it('should score based on line count', () => {
      const smallContent = 'line\n'.repeat(50)
      const mediumContent = 'export const x = 1\n'.repeat(250) // lines>200 (1) + exports (1) = 2 = medium
      const largeContent = 'line\n'.repeat(600) // lines>500 (2) = medium

      const smallImportance = extractor.determineImportance(smallContent, '.ts')
      const mediumImportance = extractor.determineImportance(mediumContent, '.ts')
      const largeImportance = extractor.determineImportance(largeContent, '.ts')

      expect(smallImportance).toBe('low')
      expect(mediumImportance).toBe('medium')
      expect(largeImportance).toBe('medium')
    })
  })

  describe('extractCategory', () => {
    it('should extract category from src path', () => {
      const category = extractor.extractCategory('/project/src/core/file.ts')
      expect(category).toBe('core')
    })

    it('should extract category from nested path', () => {
      const category = extractor.extractCategory('/project/src/services/auth/file.ts')
      expect(category).toBe('services')
    })

    it('should return undefined for path without src', () => {
      const category = extractor.extractCategory('/project/core/file.ts')
      expect(category).toBeUndefined()
    })

    it('should return undefined for path with src at end', () => {
      const category = extractor.extractCategory('/project/src')
      expect(category).toBeUndefined()
    })

    it('should handle Windows paths', () => {
      const category = extractor.extractCategory('C:\\project\\src\\utils\\file.ts')
      expect(category).toBe('utils')
    })

    it('should handle empty path', () => {
      const category = extractor.extractCategory('')
      expect(category).toBeUndefined()
    })
  })

  describe('extractModule', () => {
    it('should extract module from src path', () => {
      const module = extractor.extractModule('/project/src/core/file.ts')
      expect(module).toBe('core')
    })

    it('should extract module from nested path', () => {
      const module = extractor.extractModule('/project/src/services/auth/file.ts')
      expect(module).toBe('services')
    })

    it('should return undefined for path without src', () => {
      const module = extractor.extractModule('/project/core/file.ts')
      expect(module).toBeUndefined()
    })

    it('should return undefined for path with src at end', () => {
      const module = extractor.extractModule('/project/src')
      expect(module).toBeUndefined()
    })

    it('should handle Windows paths', () => {
      const module = extractor.extractModule('C:\\project\\src\\utils\\file.ts')
      expect(module).toBe('utils')
    })
  })

  describe('extractLayer', () => {
    it('should extract core layer', () => {
      const layer = extractor.extractLayer('/project/src/core/file.ts')
      expect(layer).toBe('core')
    })

    it('should extract utils layer', () => {
      const layer = extractor.extractLayer('/project/src/utils/helper.ts')
      expect(layer).toBe('utils')
    })

    it('should extract api layer', () => {
      const layer = extractor.extractLayer('/project/src/api/routes.ts')
      expect(layer).toBe('api')
    })

    it('should extract services layer', () => {
      const layer = extractor.extractLayer('/project/src/services/auth.ts')
      expect(layer).toBe('services')
    })

    it('should extract components layer', () => {
      const layer = extractor.extractLayer('/project/src/components/Button.tsx')
      expect(layer).toBe('components')
    })

    it('should extract pages layer', () => {
      const layer = extractor.extractLayer('/project/src/pages/Home.tsx')
      expect(layer).toBe('pages')
    })

    it('should return undefined for unknown layer', () => {
      const layer = extractor.extractLayer('/project/src/unknown/file.ts')
      expect(layer).toBeUndefined()
    })

    it('should return undefined for path without recognized layer', () => {
      const layer = extractor.extractLayer('/project/other/file.ts')
      expect(layer).toBeUndefined()
    })

    it('should find layer anywhere in path', () => {
      const layer = extractor.extractLayer('/project/core/deep/nested/file.ts')
      expect(layer).toBe('core')
    })
  })

  describe('generatePageName', () => {
    it('should generate page name from file path', () => {
      const name = extractor.generatePageName('/project/src/file.ts')
      expect(name).toBe('file')
    })

    it('should convert to lowercase', () => {
      const name = extractor.generatePageName('/project/src/MyFile.ts')
      expect(name).toBe('myfile')
    })

    it('should replace special characters with hyphens', () => {
      const name = extractor.generatePageName('/project/src/my-file_name.ts')
      expect(name).toBe('my-file-name')
    })

    it('should remove extension', () => {
      const name = extractor.generatePageName('/project/src/component.test.tsx')
      expect(name).toBe('component-test')
    })

    it('should handle files with multiple dots', () => {
      const name = extractor.generatePageName('/project/src/file.spec.ts')
      expect(name).toBe('file-spec')
    })

    it('should handle Windows paths', () => {
      const name = extractor.generatePageName('C:\\project\\src\\File.ts')
      expect(name).toBe('file')
    })

    it('should handle empty path', () => {
      const name = extractor.generatePageName('')
      expect(name).toBe('')
    })
  })

  describe('determinePageTypeFallback', () => {
    it('should return entity for TypeScript files', () => {
      const type = extractor.determinePageTypeFallback('/project/src/file.ts')
      expect(type).toBe('entity')
    })

    it('should return entity for TSX files', () => {
      const type = extractor.determinePageTypeFallback('/project/src/component.tsx')
      expect(type).toBe('entity')
    })

    it('should return entity for JavaScript files', () => {
      const type = extractor.determinePageTypeFallback('/project/src/file.js')
      expect(type).toBe('entity')
    })

    it('should return entity for JSX files', () => {
      const type = extractor.determinePageTypeFallback('/project/src/component.jsx')
      expect(type).toBe('entity')
    })

    it('should return entity for Python files', () => {
      const type = extractor.determinePageTypeFallback('/project/src/file.py')
      expect(type).toBe('entity')
    })

    it('should return concept for README files', () => {
      const type = extractor.determinePageTypeFallback('/project/README.md')
      expect(type).toBe('concept')
    })

    it('should return concept for docs directory files', () => {
      const type = extractor.determinePageTypeFallback('/project/docs/guide.md')
      expect(type).toBe('concept')
    })

    it('should return source for other files', () => {
      const type = extractor.determinePageTypeFallback('/project/config.json')
      expect(type).toBe('source')
    })

    it('should return source for unknown extensions', () => {
      const type = extractor.determinePageTypeFallback('/project/file.xyz')
      expect(type).toBe('source')
    })

    it('should handle case-insensitive README', () => {
      const type = extractor.determinePageTypeFallback('/project/readme.md')
      expect(type).toBe('concept')
    })
  })

  describe('extractTags', () => {
    it('should extract code structure keywords as tags', () => {
      const content = 'class Foo { } function bar() { } interface Baz { }'
      const tags = extractor.extractTags(content, '.ts')
      expect(tags).toContain('class')
      expect(tags).toContain('function')
      expect(tags).toContain('interface')
    })

    it('should extract import and export keywords', () => {
      const content = 'import { foo } from "bar"\nexport const x = 1'
      const tags = extractor.extractTags(content, '.ts')
      expect(tags).toContain('import')
      expect(tags).toContain('export')
    })

    it('should deduplicate tags', () => {
      const content = 'class A { } class B { } class C { }'
      const tags = extractor.extractTags(content, '.ts')
      const classCount = tags.filter(t => t === 'class').length
      expect(classCount).toBe(1)
    })

    it('should convert tags to lowercase', () => {
      const content = 'CLASS Foo { } FUNCTION bar() { }'
      const tags = extractor.extractTags(content, '.ts')
      expect(tags).toContain('class')
      expect(tags).toContain('function')
    })

    it('should limit to 5 tags', () => {
      const content = 'class interface function module export import'
      const tags = extractor.extractTags(content, '.ts')
      expect(tags.length).toBeLessThanOrEqual(5)
    })

    it('should return empty array for content without keywords', () => {
      const content = 'const x = 1\nconst y = 2'
      const tags = extractor.extractTags(content, '.ts')
      expect(tags).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const tags = extractor.extractTags('', '.ts')
      expect(tags).toEqual([])
    })

    it('should handle mixed language content', () => {
      const content = 'class Foo:\n    def bar(self):\n        pass'
      const tags = extractor.extractTags(content, '.py')
      expect(tags).toContain('class')
    })
  })

  describe('extractImports', () => {
    it('should extract TypeScript imports', () => {
      const content = 'import { foo } from "lodash"\nimport * as bar from "react"'
      const imports = extractor.extractImports(content, '.ts')
      expect(imports).toContain('lodash')
      expect(imports).toContain('react')
    })

    it('should extract TSX imports', () => {
      const content = 'import React from "react"\nimport { Button } from "antd"'
      const imports = extractor.extractImports(content, '.tsx')
      expect(imports).toContain('react')
      expect(imports).toContain('antd')
    })

    it('should extract JavaScript imports', () => {
      const content = 'import { foo } from "module"'
      const imports = extractor.extractImports(content, '.js')
      expect(imports).toContain('module')
    })

    it('should extract JSX imports', () => {
      const content = 'import React from "react"'
      const imports = extractor.extractImports(content, '.jsx')
      expect(imports).toContain('react')
    })

    it('should return empty array for unknown extension', () => {
      const imports = extractor.extractImports('import foo', '.py')
      expect(imports).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const imports = extractor.extractImports('', '.ts')
      expect(imports).toEqual([])
    })

    it('should handle named imports', () => {
      const content = 'import { useState, useEffect } from "react"'
      const imports = extractor.extractImports(content, '.ts')
      expect(imports).toContain('react')
    })

    it('should handle default imports', () => {
      const content = 'import React from "react"'
      const imports = extractor.extractImports(content, '.ts')
      expect(imports).toContain('react')
    })

    it('should handle namespace imports', () => {
      const content = 'import * as _ from "lodash"'
      const imports = extractor.extractImports(content, '.ts')
      expect(imports).toContain('lodash')
    })
  })

  describe('extractFunctions', () => {
    it('should extract TypeScript function declarations', () => {
      const content = 'function foo() { }\nfunction bar() { }'
      const functions = extractor.extractFunctions(content, '.ts')
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract TypeScript arrow functions', () => {
      const content = 'const foo = () => { }\nconst bar = async () => { }'
      const functions = extractor.extractFunctions(content, '.ts')
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract TypeScript method declarations', () => {
      const content = 'class Foo {\n  bar(): void { }\n}'
      const functions = extractor.extractFunctions(content, '.ts')
      expect(functions).toContain('bar')
    })

    it('should extract TSX functions', () => {
      const content = 'function Component() { }\nconst handler = () => { }'
      const functions = extractor.extractFunctions(content, '.tsx')
      expect(functions).toContain('Component')
      expect(functions).toContain('handler')
    })

    it('should extract JavaScript functions', () => {
      const content = 'function foo() { }\nconst bar = () => { }'
      const functions = extractor.extractFunctions(content, '.js')
      expect(functions).toContain('foo')
      expect(functions).toContain('bar')
    })

    it('should extract JSX functions', () => {
      const content = 'function Component() { }'
      const functions = extractor.extractFunctions(content, '.jsx')
      expect(functions).toContain('Component')
    })

    it('should filter out private functions starting with underscore', () => {
      const content = 'function _private() { }\nfunction public() { }'
      const functions = extractor.extractFunctions(content, '.ts')
      expect(functions).not.toContain('_private')
      expect(functions).toContain('public')
    })

    it('should return empty array for unknown extension', () => {
      const functions = extractor.extractFunctions('function foo() { }', '.py')
      expect(functions).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const functions = extractor.extractFunctions('', '.ts')
      expect(functions).toEqual([])
    })

    it('should handle functions with type annotations', () => {
      const content = 'function add(a: number, b: number): number { return a + b }'
      const functions = extractor.extractFunctions(content, '.ts')
      expect(functions).toContain('add')
    })
  })

  describe('generateDescription', () => {
    it('should return first line of content', () => {
      const content = 'This is the first line\nThis is the second line'
      const description = extractor.generateDescription(content)
      expect(description).toBe('This is the first line')
    })

    it('should limit to 100 characters', () => {
      const longLine = 'a'.repeat(150)
      const description = extractor.generateDescription(longLine)
      expect(description.length).toBe(103) // 100 + '...'
      expect(description.endsWith('...')).toBe(true)
    })

    it('should not add ellipsis for short lines', () => {
      const content = 'Short line'
      const description = extractor.generateDescription(content)
      expect(description).toBe('Short line')
      expect(description.endsWith('...')).toBe(false)
    })

    it('should skip empty lines', () => {
      const content = '\n\n  \nFirst non-empty line'
      const description = extractor.generateDescription(content)
      expect(description).toBe('First non-empty line')
    })

    it('should handle empty content', () => {
      const description = extractor.generateDescription('')
      expect(description).toBe('')
    })

    it('should handle content with only whitespace', () => {
      const description = extractor.generateDescription('   \n  \n  ')
      expect(description).toBe('')
    })

    it('should handle single line content', () => {
      const content = 'Single line'
      const description = extractor.generateDescription(content)
      expect(description).toBe('Single line')
    })

    it('should trim whitespace from first line', () => {
      const content = '  First line with spaces  '
      const description = extractor.generateDescription(content)
      expect(description).toBe('  First line with spaces  ')
    })
  })
})
