# Further Code Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 继续拆分KnowledgeBase类（从1868行减到<500行）并提高测试覆盖率（从>50%提升到>80%）

**Architecture:** 提取ContentExtractor、DocGenerator、ContentSearcher三个专职类，并添加全面的单元测试和集成测试

**Tech Stack:** TypeScript 5.0+, Bun Runtime, TDD methodology

---

## Phase 1: Extract ContentExtractor (Tasks 1-3)

### Task 1: Extract ContentExtractor class

**Files:**
- Create: `src/core/content-extractor.ts`
- Create: `tests/content-extractor.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'bun:test'
import { ContentExtractor } from '../src/core/content-extractor'

describe('ContentExtractor', () => {
  const extractor = new ContentExtractor()
  
  describe('calculateHash', () => {
    it('should calculate MD5 hash', () => {
      const hash = extractor.calculateHash('test content')
      expect(hash).toBeDefined()
      expect(hash.length).toBe(16)
    })
    
    it('should return consistent hash for same input', () => {
      const hash1 = extractor.calculateHash('test')
      const hash2 = extractor.calculateHash('test')
      expect(hash1).toBe(hash2)
    })
  })
  
  describe('getLanguage', () => {
    it('should return typescript for .ts extension', () => {
      expect(extractor.getLanguage('.ts')).toBe('typescript')
    })
    
    it('should return javascript for .js extension', () => {
      expect(extractor.getLanguage('.js')).toBe('javascript')
    })
    
    it('should return text for unknown extension', () => {
      expect(extractor.getLanguage('.unknown')).toBe('text')
    })
  })
  
  describe('extractKeywords', () => {
    it('should extract TypeScript keywords', () => {
      const content = 'class Test { } interface ITest { } function test() { }'
      const keywords = extractor.extractKeywords(content, '.ts')
      
      expect(keywords).toContain('class')
      expect(keywords).toContain('interface')
      expect(keywords).toContain('function')
    })
    
    it('should return empty array for unsupported extension', () => {
      const keywords = extractor.extractKeywords('some content', '.unknown')
      expect(keywords).toEqual([])
    })
  })
  
  describe('extractKeyFunctions', () => {
    it('should extract function names from TypeScript', () => {
      const content = 'function hello() {} const world = () => {}'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      
      expect(functions).toBeDefined()
      expect(functions).toContain('hello')
      expect(functions).toContain('world')
    })
    
    it('should return undefined for no functions', () => {
      const content = 'const x = 1'
      const functions = extractor.extractKeyFunctions(content, '.ts')
      expect(functions).toBeUndefined()
    })
  })
  
  describe('extractDependencies', () => {
    it('should extract import statements', () => {
      const content = "import { test } from 'lodash'\nimport path from 'path'"
      const deps = extractor.extractDependencies(content, '.ts')
      
      expect(deps).toContain('lodash')
      expect(deps).toContain('path')
    })
    
    it('should filter out relative imports', () => {
      const content = "import { test } from './local'"
      const deps = extractor.extractDependencies(content, '.ts')
      
      expect(deps).not.toContain('./local')
    })
  })
  
  describe('determineImportance', () => {
    it('should return critical for large files with exports and tests', () => {
      const content = Array(600).fill('export function test() {}').join('\n')
      const importance = extractor.determineImportance(content, '.ts')
      
      expect(importance).toBe('critical')
    })
    
    it('should return low for small files', () => {
      const content = 'const x = 1'
      const importance = extractor.determineImportance(content, '.ts')
      
      expect(importance).toBe('low')
    })
  })
  
  describe('extractCategory', () => {
    it('should extract category from src subdirectory', () => {
      const category = extractor.extractCategory('/project/src/components/Button.tsx')
      expect(category).toBe('components')
    })
    
    it('should return undefined for no src directory', () => {
      const category = extractor.extractCategory('/project/components/Button.tsx')
      expect(category).toBeUndefined()
    })
  })
  
  describe('extractModule', () => {
    it('should extract module from src subdirectory', () => {
      const module = extractor.extractModule('/project/src/auth/login.ts')
      expect(module).toBe('auth')
    })
  })
  
  describe('extractLayer', () => {
    it('should detect core layer', () => {
      const layer = extractor.extractLayer('/project/src/core/knowledge-base.ts')
      expect(layer).toBe('core')
    })
    
    it('should detect utils layer', () => {
      const layer = extractor.extractLayer('/project/src/utils/logger.ts')
      expect(layer).toBe('utils')
    })
    
    it('should return undefined for unknown layer', () => {
      const layer = extractor.extractLayer('/project/src/unknown/file.ts')
      expect(layer).toBeUndefined()
    })
  })
  
  describe('generatePageName', () => {
    it('should generate lowercase hyphenated name', () => {
      const name = extractor.generatePageName('/path/to/MyComponent.tsx')
      expect(name).toBe('mycomponent')
    })
    
    it('should replace special characters', () => {
      const name = extractor.generatePageName('/path/to/my-component_v2.ts')
      expect(name).toBe('my-component-v2')
    })
  })
  
  describe('determinePageTypeFallback', () => {
    it('should return entity for TypeScript files', () => {
      expect(extractor.determinePageTypeFallback('/path/to/file.ts')).toBe('entity')
    })
    
    it('should return concept for README files', () => {
      expect(extractor.determinePageTypeFallback('/path/README.md')).toBe('concept')
    })
    
    it('should return source for other files', () => {
      expect(extractor.determinePageTypeFallback('/path/config.json')).toBe('source')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/content-extractor.test.ts`
Expected: FAIL with "Cannot find module '../src/core/content-extractor'"

**Step 3: Write minimal implementation**

```typescript
import crypto from 'crypto'
import path from 'path'

export class ContentExtractor {
  calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  }
  
  getLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.sql': 'sql',
      '.proto': 'protobuf',
      '.graphql': 'graphql',
      '.gql': 'graphql',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.html': 'html',
      '.htm': 'html',
    }
    return languageMap[ext] || 'text'
  }
  
  extractKeywords(content: string, ext: string): string[] {
    const keywords: string[] = []
    
    const patterns: Record<string, RegExp> = {
      '.ts': /\b(class|interface|type|enum|function|const|let|var|import|export|async|await)\b/gi,
      '.tsx': /\b(class|interface|type|enum|function|const|let|var|import|export|async|await)\b/gi,
      '.js': /\b(class|function|const|let|var|import|export|async|await)\b/gi,
      '.jsx': /\b(class|function|const|let|var|import|export|async|await)\b/gi,
      '.py': /\b(class|def|import|from|async|await|lambda)\b/gi,
      '.java': /\b(class|interface|enum|extends|implements|import|package)\b/gi,
      '.go': /\b(func|type|struct|interface|package|import)\b/gi,
    }
    
    const pattern = patterns[ext]
    if (pattern) {
      const matches = content.match(pattern)
      if (matches) {
        keywords.push(...[...new Set(matches.map(k => k.toLowerCase()))].slice(0, 10))
      }
    }
    
    return keywords
  }
  
  extractKeyFunctions(content: string, ext: string): string[] | undefined {
    const functions: string[] = []
    
    const patterns: Record<string, RegExp> = {
      '.ts': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)/g,
      '.tsx': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)/g,
      '.js': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g,
      '.jsx': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g,
      '.py': /def\s+(\w+)/g,
      '.go': /func\s+(?:\([^)]+\)\s*)?(\w+)/g,
    }
    
    const pattern = patterns[ext]
    if (pattern) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const funcName = match[1] || match[2] || match[3]
        if (funcName && !funcName.startsWith('_')) {
          functions.push(funcName)
        }
      }
    }
    
    return functions.length > 0 ? functions.slice(0, 10) : undefined
  }
  
  extractDependencies(content: string, ext: string): string[] {
    const dependencies: string[] = []
    
    const patterns: Record<string, RegExp> = {
      '.ts': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.tsx': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.js': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.jsx': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.py': /(?:import|from)\s+(\w+)/g,
      '.go': /import\s+(?:\([^)]+\)|"([^"]+)")/g,
    }
    
    const pattern = patterns[ext]
    if (pattern) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const dep = match[1] || match[0]
        if (dep && !dep.startsWith('.')) {
          dependencies.push(dep)
        }
      }
    }
    
    return [...new Set(dependencies)].slice(0, 20)
  }
  
  determineImportance(content: string, ext: string): 'low' | 'medium' | 'high' | 'critical' {
    const lines = content.split('\n').length
    const hasExports = /export\s+/.test(content)
    const hasTests = /test|spec|describe|it\s*\(/i.test(content)
    const hasDocs = /\/\*\*[\s\S]*?\*\//.test(content) || /\/\/.*/.test(content)
    
    let score = 0
    if (lines > 500) score += 2
    else if (lines > 200) score += 1
    
    if (hasExports) score += 1
    if (hasTests) score += 1
    if (hasDocs) score += 1
    
    if (score >= 4) return 'critical'
    if (score >= 3) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }
  
  extractCategory(filePath: string): string | undefined {
    const parts = filePath.split(path.sep)
    const srcIndex = parts.findIndex(p => p === 'src')
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1]
    }
    return undefined
  }
  
  extractModule(filePath: string): string | undefined {
    const parts = filePath.split(path.sep)
    const srcIndex = parts.findIndex(p => p === 'src')
    if (srcIndex >= 0 && srcIndex + 2 < parts.length) {
      return parts[srcIndex + 1]
    }
    return undefined
  }
  
  extractLayer(filePath: string): string | undefined {
    const parts = filePath.split(path.sep)
    const layers = ['core', 'utils', 'types', 'api', 'services', 'components', 'pages']
    for (const layer of layers) {
      if (parts.includes(layer)) {
        return layer
      }
    }
    return undefined
  }
  
  generatePageName(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath))
    return basename.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }
  
  determinePageTypeFallback(filePath: string): 'entity' | 'concept' | 'source' {
    const ext = path.extname(filePath)
    
    if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
      return 'entity'
    }
    
    if (filePath.includes('README') || filePath.includes('docs')) {
      return 'concept'
    }
    
    return 'source'
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/content-extractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/content-extractor.ts tests/content-extractor.test.ts
git commit -m "feat: extract ContentExtractor from KnowledgeBase

- Create ContentExtractor for content analysis
- Support hash, language, keywords, functions extraction
- Add comprehensive unit tests"
```

---

### Task 2: Add remaining methods to ContentExtractor

**Files:**
- Modify: `src/core/content-extractor.ts`
- Modify: `tests/content-extractor.test.ts`

**Step 1: Add tests for remaining methods**

```typescript
describe('extractTags', () => {
  it('should extract code tags', () => {
    const content = 'function test() {} class MyClass {}'
    const tags = extractor.extractTags(content, '.ts')
    
    expect(tags).toContain('function')
    expect(tags).toContain('class')
  })
})

describe('extractImports', () => {
  it('should extract import paths', () => {
    const content = "import path from 'path'\nimport { test } from './test'"
    const imports = extractor.extractImports(content, '.ts')
    
    expect(imports).toContain("path from 'path'")
    expect(imports.length).toBeGreaterThan(0)
  })
})

describe('extractFunctions', () => {
  it('should extract function signatures', () => {
    const content = 'function hello(name: string): void {}\nconst world = () => {}'
    const functions = extractor.extractFunctions(content, '.ts')
    
    expect(functions.length).toBeGreaterThan(0)
  })
})

describe('generateDescription', () => {
  it('should generate description from content', () => {
    const content = '/**\n * This is a test function\n */\nfunction test() {}'
    const desc = extractor.generateDescription(content)
    
    expect(desc).toBeDefined()
    expect(desc.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Implement remaining methods**

```typescript
extractTags(content: string, ext: string): string[] {
  const tags: string[] = []
  
  const keywords = content.match(/\b(function|class|interface|module|export|import)\b/gi)
  if (keywords) {
    tags.push(...[...new Set(keywords.map(k => k.toLowerCase()))])
  }
  
  return tags.slice(0, 5)
}

extractImports(content: string, ext: string): string[] {
  const imports: string[] = []
  
  const patterns: Record<string, RegExp> = {
    '.ts': /import\s+.+from\s+['"][^'"]+['"]/g,
    '.tsx': /import\s+.+from\s+['"][^'"]+['"]/g,
    '.js': /import\s+.+from\s+['"][^'"]+['"]/g,
    '.jsx': /import\s+.+from\s+['"][^'"]+['"]/g,
  }
  
  const pattern = patterns[ext]
  if (pattern) {
    const matches = content.match(pattern)
    if (matches) {
      imports.push(...matches)
    }
  }
  
  return imports
}

extractFunctions(content: string, ext: string): string[] {
  const functions: string[] = []
  
  const patterns: Record<string, RegExp> = {
    '.ts': /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\))/g,
    '.tsx': /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\))/g,
    '.js': /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\))/g,
    '.jsx': /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\))/g,
  }
  
  const pattern = patterns[ext]
  if (pattern) {
    const matches = content.match(pattern)
    if (matches) {
      functions.push(...matches.slice(0, 10))
    }
  }
  
  return functions
}

generateDescription(content: string): string {
  const docComment = /\/\*\*[\s\S]*?\*\//.exec(content)
  if (docComment) {
    const lines = docComment[0]
      .replace(/\/\*\*|\*\//g, '')
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0 && !l.startsWith('@'))
    
    if (lines.length > 0) {
      return lines.slice(0, 3).join(' ').substring(0, 200)
    }
  }
  
  const firstLine = content.split('\n').find(l => l.trim().length > 0)
  if (firstLine) {
    return firstLine.trim().substring(0, 200)
  }
  
  return 'No description available'
}
```

**Step 3: Run tests**

Run: `bun test tests/content-extractor.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/content-extractor.ts tests/content-extractor.test.ts
git commit -m "feat: add remaining methods to ContentExtractor

- Add extractTags, extractImports, extractFunctions
- Add generateDescription method
- Add comprehensive tests"
```

---

### Task 3: Integrate ContentExtractor into KnowledgeBase

**Files:**
- Modify: `src/core/knowledge-base.ts`
- Test: Run all tests

**Step 1: Import and instantiate ContentExtractor**

```typescript
import { ContentExtractor } from './content-extractor'

export class KnowledgeBase {
  // ... existing properties ...
  private contentExtractor: ContentExtractor
  
  constructor(projectPath: string) {
    // ... existing initialization ...
    this.contentExtractor = new ContentExtractor()
  }
}
```

**Step 2: Replace method calls**

Replace all `this.calculateHash()` with `this.contentExtractor.calculateHash()`
Replace all `this.getLanguage()` with `this.contentExtractor.getLanguage()`
And so on for all extracted methods.

**Step 3: Remove old methods**

Remove the following methods from KnowledgeBase:
- calculateHash
- getLanguage
- extractKeywords
- extractKeyFunctions
- extractDependencies
- determineImportance
- extractCategory
- extractModule
- extractLayer
- generatePageName
- determinePageTypeFallback
- extractTags
- extractImports
- extractFunctions
- generateDescription

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/core/knowledge-base.ts
git commit -m "refactor: integrate ContentExtractor into KnowledgeBase

- Use ContentExtractor for content analysis
- Remove duplicate methods
- Reduce KnowledgeBase complexity"
```

---

## Phase 2: Extract DocGenerator (Tasks 4-6)

### Task 4: Extract DocGenerator class

**Files:**
- Create: `src/core/doc-generator.ts`
- Create: `tests/doc-generator.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { DocGenerator } from '../src/core/doc-generator'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import type { ProjectArchitecture, CodeStyle, DirectoryNode } from '../src/types'

describe('DocGenerator', () => {
  let generator: DocGenerator
  let testDir: string
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-gen-test-'))
    generator = new DocGenerator(testDir)
  })
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })
  
  describe('generateArchitectureDoc', () => {
    it('should generate architecture doc for empty project', async () => {
      const architecture: ProjectArchitecture = {
        structure: { totalFiles: 0, totalDirs: 0, maxDepth: 0, directories: [] },
        structureScore: { total: 0, directory: 0, config: 0, organization: 0, documentation: 0, level: 'messy' },
        techStack: { languages: [], frameworks: [], libraries: [], tools: [] },
        modules: [],
        entryPoints: [],
        layers: [],
        lastAnalyzed: new Date().toISOString()
      }
      
      await generator.generateArchitectureDoc(architecture)
      
      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      
      expect(content).toContain('empty project')
    })
    
    it('should generate architecture doc with modules', async () => {
      const architecture: ProjectArchitecture = {
        structure: { totalFiles: 10, totalDirs: 3, maxDepth: 2, directories: [] },
        structureScore: { total: 80, directory: 25, config: 25, organization: 20, documentation: 10, level: 'clear' },
        techStack: {
          languages: [{ name: 'TypeScript', percentage: 100, fileCount: 10, extensions: ['.ts'] }],
          frameworks: [],
          libraries: [],
          tools: []
        },
        modules: [{ name: 'core', path: 'src/core', type: 'module', fileCount: 5 }],
        entryPoints: ['src/index.ts'],
        layers: [],
        lastAnalyzed: new Date().toISOString()
      }
      
      await generator.generateArchitectureDoc(architecture)
      
      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      
      expect(content).toContain('Structure Score')
      expect(content).toContain('80/100')
      expect(content).toContain('core')
    })
  })
  
  describe('renderDirectoryTree', () => {
    it('should render directory tree', () => {
      const nodes: DirectoryNode[] = [
        { name: 'src', type: 'directory', children: [
          { name: 'core', type: 'directory', children: [] },
          { name: 'utils', type: 'directory', children: [] }
        ]},
        { name: 'tests', type: 'directory', children: [] }
      ]
      
      const tree = generator.renderDirectoryTree(nodes, 0)
      
      expect(tree).toContain('src/')
      expect(tree).toContain('tests/')
    })
  })
  
  describe('generateCodeStyleDoc', () => {
    it('should generate code style doc', async () => {
      const styles: CodeStyle[] = [{
        language: 'TypeScript',
        summary: 'Clean TypeScript code',
        namingConventions: [
          { type: 'class', style: 'PascalCase', consistency: 1, examples: ['MyClass'] }
        ],
        formatting: { indent: 'space', indentSize: 2, semicolons: true, quotes: 'single', trailingComma: true },
        bestPractices: [
          { name: 'Explicit types', status: 'adopted', description: 'Use explicit types' }
        ]
      }]
      
      await generator.generateCodeStyleDoc(styles)
      
      const docPath = path.join(testDir, 'code-style.md')
      const exists = await fs.access(docPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/doc-generator.test.ts`
Expected: FAIL

**Step 3: Implement DocGenerator**

```typescript
import path from 'path'
import { promises as fs } from 'fs'
import type { ProjectArchitecture, CodeStyle, DirectoryNode } from '../types'

export class DocGenerator {
  private basePath: string
  
  constructor(basePath: string) {
    this.basePath = basePath
  }
  
  async generateArchitectureDoc(architecture: ProjectArchitecture): Promise<void> {
    if (architecture.structure.totalFiles === 0) {
      const content = `# Project Architecture

## Overview

This is an empty project. No files have been detected.

Please add source files and run \`/memory-ingest\` to generate architecture analysis.
`
      await fs.writeFile(path.join(this.basePath, 'architecture.md'), content, 'utf-8')
      return
    }
    
    const content = `# Project Architecture

## Overview

- **Structure Score**: ${architecture.structureScore.total}/100 (${architecture.structureScore.level})
- **Total Files**: ${architecture.structure.totalFiles}
- **Total Directories**: ${architecture.structure.totalDirs}
- **Max Depth**: ${architecture.structure.maxDepth}
- **Last Analyzed**: ${architecture.lastAnalyzed.split('T')[0]}

## Structure Score Breakdown

| Category | Score | Description |
|----------|-------|-------------|
| Directory Structure | ${architecture.structureScore.directory}/30 | Standard directories and module organization |
| Configuration | ${architecture.structureScore.config}/30 | Package manager, lint, and test configs |
| Code Organization | ${architecture.structureScore.organization}/25 | Naming consistency and module boundaries |
| Documentation | ${architecture.structureScore.documentation}/15 | README, API docs, architecture docs |

## Technology Stack

### Languages

${architecture.techStack.languages.map(l => 
  `- **${l.name}**: ${l.percentage}% (${l.fileCount} files)`
).join('\n')}

## Module Structure

${architecture.modules.length > 0 
  ? architecture.modules.map(m => 
      `### ${m.name}\n\n- **Path**: \`${m.path}\`\n- **Type**: ${m.type}\n- **Files**: ${m.fileCount}`
    ).join('\n\n')
  : 'No standard modules detected'}

## Entry Points

${architecture.entryPoints.length > 0
  ? architecture.entryPoints.map(e => `- \`${e}\``).join('\n')
  : 'No standard entry points detected'}

## Directory Tree

\`\`\`
${this.renderDirectoryTree(architecture.structure.directories, 0).slice(0, 100)}
\`\`\`
`

    await fs.writeFile(
      path.join(this.basePath, 'architecture.md'),
      content,
      'utf-8'
    )
  }
  
  renderDirectoryTree(nodes: DirectoryNode[], depth: number): string {
    const lines: string[] = []
    const indent = '  '.repeat(depth)
    
    for (const node of nodes.slice(0, 20)) {
      const prefix = depth === 0 ? '' : indent + '├── '
      lines.push(`${prefix}${node.name}/`)
      
      if (node.children && depth < 3) {
        for (const child of node.children.slice(0, 10)) {
          if (child.type === 'directory') {
            lines.push(`${indent}    ├── ${child.name}/`)
          }
        }
        if (node.children.length > 10) {
          lines.push(`${indent}    └── ... (${node.children.length - 10} more)`)
        }
      }
    }
    
    return lines.join('\n')
  }
  
  async generateCodeStyleDoc(styles: CodeStyle[]): Promise<void> {
    if (styles.length === 0) {
      return
    }

    const content = `# Code Style Guide

## Overview

This document describes the code style conventions detected in the project.

${styles.map(style => `
## ${style.language}

### Summary

${style.summary}

### Naming Conventions

| Type | Style | Consistency | Examples |
|------|-------|-------------|----------|
${style.namingConventions.map(nc => 
  `| ${nc.type} | ${nc.style} | ${Math.round(nc.consistency * 100)}% | ${nc.examples.slice(0, 3).join(', ')} |`
).join('\n')}

### Formatting

- **Indent**: ${style.formatting.indent} (${style.formatting.indentSize} spaces)
- **Semicolons**: ${style.formatting.semicolons ? 'Yes' : 'No'}
- **Quotes**: ${style.formatting.quotes}
- **Trailing Comma**: ${style.formatting.trailingComma ? 'Yes' : 'No'}

### Best Practices

${style.bestPractices.map(bp => 
  `- **${bp.name}**: ${bp.status === 'adopted' ? '✅' : bp.status === 'partial' ? '⚠️' : '❌'} ${bp.description}${bp.evidence ? ` (${bp.evidence})` : ''}`
).join('\n')}
`).join('\n')}
`

    await fs.writeFile(
      path.join(this.basePath, 'code-style.md'),
      content,
      'utf-8'
    )
  }
}
```

**Step 4: Run tests**

Run: `bun test tests/doc-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/doc-generator.ts tests/doc-generator.test.ts
git commit -m "feat: extract DocGenerator from KnowledgeBase

- Create DocGenerator for documentation generation
- Support architecture and code style docs
- Add comprehensive tests"
```

---

### Task 5: Integrate DocGenerator into KnowledgeBase

**Files:**
- Modify: `src/core/knowledge-base.ts`

**Step 1: Import and instantiate**

```typescript
import { DocGenerator } from './doc-generator'

export class KnowledgeBase {
  private docGenerator: DocGenerator
  
  constructor(projectPath: string) {
    // ...
    this.docGenerator = new DocGenerator(this.basePath)
  }
}
```

**Step 2: Replace method calls**

Replace `this.generateArchitectureDoc()` with `this.docGenerator.generateArchitectureDoc()`
Replace `this.generateCodeStyleDoc()` with `this.docGenerator.generateCodeStyleDoc()`
Replace `this.renderDirectoryTree()` with `this.docGenerator.renderDirectoryTree()`

**Step 3: Remove old methods**

Remove generateArchitectureDoc, renderDirectoryTree, generateCodeStyleDoc, generateStyleRecommendations

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/knowledge-base.ts
git commit -m "refactor: integrate DocGenerator into KnowledgeBase

- Use DocGenerator for documentation
- Remove duplicate methods
- Further reduce complexity"
```

---

## Phase 3: Extract ContentSearcher (Task 6)

### Task 6: Extract ContentSearcher class

**Files:**
- Create: `src/core/content-searcher.ts`
- Create: `tests/content-searcher.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'bun:test'
import { ContentSearcher } from '../src/core/content-searcher'

describe('ContentSearcher', () => {
  const searcher = new ContentSearcher()
  
  describe('searchContent', () => {
    it('should find matches in content', async () => {
      const pages = new Map([
        ['page1', { content: 'This is a test page with test content', filePath: '/test1.md' }],
        ['page2', { content: 'Another page without the keyword', filePath: '/test2.md' }]
      ])
      
      const results = await searcher.searchContent(pages, 'test')
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].pageId).toBe('page1')
    })
    
    it('should return empty array for no matches', async () => {
      const pages = new Map([
        ['page1', { content: 'No matches here', filePath: '/test1.md' }]
      ])
      
      const results = await searcher.searchContent(pages, 'nonexistent')
      
      expect(results).toEqual([])
    })
  })
  
  describe('findMatchesInContent', () => {
    it('should find all matches with context', () => {
      const content = 'Line 1\nLine 2 with test keyword\nLine 3'
      const matches = searcher.findMatchesInContent(content, 'test', 1)
      
      expect(matches.length).toBe(1)
      expect(matches[0].lineNumber).toBe(2)
      expect(matches[0].context).toContain('test')
    })
    
    it('should handle case insensitive search', () => {
      const content = 'TEST keyword in uppercase'
      const matches = searcher.findMatchesInContent(content, 'test', 1)
      
      expect(matches.length).toBe(1)
    })
  })
})
```

**Step 2: Implement ContentSearcher**

```typescript
import type { ContentSearchResult, ContentSearchPageResult, ContentSearchMatch } from '../types'

export class ContentSearcher {
  async searchContent(
    pages: Map<string, { content: string; filePath: string }>,
    query: string,
    options?: { caseSensitive?: boolean; maxResults?: number }
  ): Promise<ContentSearchResult[]> {
    const results: ContentSearchResult[] = []
    const caseSensitive = options?.caseSensitive ?? false
    const maxResults = options?.maxResults ?? 10
    
    for (const [pageId, page] of pages) {
      const matches = this.findMatchesInContent(
        page.content,
        query,
        3,
        caseSensitive
      )
      
      if (matches.length > 0) {
        results.push({
          pageId,
          filePath: page.filePath,
          matches,
          score: matches.length
        })
      }
      
      if (results.length >= maxResults) {
        break
      }
    }
    
    return results.sort((a, b) => b.score - a.score)
  }
  
  findMatchesInContent(
    content: string,
    query: string,
    contextLines: number = 3,
    caseSensitive: boolean = false
  ): ContentSearchMatch[] {
    const matches: ContentSearchMatch[] = []
    const lines = content.split('\n')
    const searchQuery = caseSensitive ? query : query.toLowerCase()
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const searchLine = caseSensitive ? line : line.toLowerCase()
      
      if (searchLine.includes(searchQuery)) {
        const startLine = Math.max(0, i - contextLines)
        const endLine = Math.min(lines.length - 1, i + contextLines)
        
        matches.push({
          lineNumber: i + 1,
          match: line,
          context: lines.slice(startLine, endLine + 1).join('\n')
        })
      }
    }
    
    return matches
  }
}
```

**Step 3: Run tests**

Run: `bun test tests/content-searcher.test.ts`
Expected: PASS

**Step 4: Integrate and commit**

```bash
git add src/core/content-searcher.ts tests/content-searcher.test.ts src/core/knowledge-base.ts
git commit -m "feat: extract ContentSearcher from KnowledgeBase

- Create ContentSearcher for content search
- Support context-aware search
- Add comprehensive tests"
```

---

## Phase 4: Improve Test Coverage (Tasks 7-9)

### Task 7: Add tests for remaining KnowledgeBase methods

**Files:**
- Modify: `tests/knowledge-base-integration.test.ts`

**Step 1: Add tests for uncovered methods**

Add tests for:
- `getPageSummary` with actual pages
- `previewChanges` with various scenarios
- `searchContent` integration
- Edge cases and error handling

**Step 2: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/knowledge-base-integration.test.ts
git commit -m "test: add more KnowledgeBase integration tests

- Add getPageSummary tests
- Add previewChanges edge cases
- Improve test coverage"
```

---

### Task 8: Add tests for utility classes

**Files:**
- Create: `tests/file-utils.test.ts`
- Create: `tests/graph-utils.test.ts`
- Create: `tests/path-mapper-extended.test.ts`

**Step 1: Add comprehensive file-utils tests**

Test all exported functions with edge cases.

**Step 2: Add graph-utils tests**

Test exportToJSON and other utility functions.

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/*.test.ts
git commit -m "test: add comprehensive utility tests

- Add file-utils tests
- Add graph-utils tests
- Improve overall test coverage"
```

---

### Task 9: Add edge case and error handling tests

**Files:**
- Modify: Various test files

**Step 1: Add edge case tests**

- Empty inputs
- Null/undefined handling
- Large file handling
- Concurrent operations

**Step 2: Add error handling tests**

- File not found
- Permission errors
- Invalid inputs
- Timeout scenarios

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/*.test.ts
git commit -m "test: add edge case and error handling tests

- Test empty/null inputs
- Test error scenarios
- Improve robustness"
```

---

## Success Criteria

### KnowledgeBase Size
- ✅ Current: 1868 lines
- ✅ Target: <500 lines
- ✅ Reduction: >70%

### Test Coverage
- ✅ Current: >50%
- ✅ Target: >80%
- ✅ New tests: 100+ additional test cases

### Code Quality
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ All extracted classes have >90% coverage

---

## Risk Mitigation

### Breaking Changes
- Maintain all public API signatures
- Use feature flags if needed
- Comprehensive integration tests

### Performance
- Benchmark before and after
- Monitor memory usage
- Profile critical paths

### Testing
- Run full test suite after each task
- Add regression tests for bugs found
- Maintain test isolation
