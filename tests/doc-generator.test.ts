import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { DocGenerator } from '../src/core/doc-generator'
import type {
  ProjectArchitecture,
  CodeStyle,
  DirectoryNode,
  DirectoryStructure,
  StructureScore,
  TechStack,
  ModuleInfo,
  LayerInfo,
  NamingConvention,
  FormattingStyle,
  BestPractice,
} from '../src/types'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Helper function to create a minimal ProjectArchitecture
 */
function createMockArchitecture(overrides: Partial<ProjectArchitecture> = {}): ProjectArchitecture {
  const defaultStructure: DirectoryStructure = {
    root: '/test-project',
    directories: [],
    maxDepth: 0,
    totalFiles: 0,
    totalDirs: 0,
  }

  const defaultScore: StructureScore = {
    total: 50,
    directory: 15,
    config: 10,
    organization: 15,
    documentation: 10,
    level: 'moderate',
  }

  const defaultTechStack: TechStack = {
    languages: [
      { name: 'TypeScript', percentage: 80, fileCount: 10, extensions: ['.ts'] },
      { name: 'JavaScript', percentage: 20, fileCount: 2, extensions: ['.js'] },
    ],
    frameworks: [{ name: 'React', version: '18.0.0', type: 'production' }],
    libraries: [{ name: 'lodash', version: '4.17.21', type: 'production' }],
    tools: [],
    packageManager: 'npm',
    buildTool: 'vite',
    testFramework: 'vitest',
  }

  return {
    structure: defaultStructure,
    structureScore: defaultScore,
    techStack: defaultTechStack,
    modules: [],
    entryPoints: [],
    layers: [],
    lastAnalyzed: '2026-04-19T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Helper function to create a minimal CodeStyle
 */
function createMockCodeStyle(overrides: Partial<CodeStyle> = {}): CodeStyle {
  const defaultNaming: NamingConvention[] = [
    {
      type: 'variable',
      style: 'camelCase',
      consistency: 0.95,
      examples: ['userName', 'pageCount'],
    },
    {
      type: 'function',
      style: 'camelCase',
      consistency: 0.9,
      examples: ['getUser', 'setData'],
    },
  ]

  const defaultFormatting: FormattingStyle = {
    indent: 'space',
    indentSize: 2,
    semicolons: true,
    quotes: 'single',
    trailingComma: true,
  }

  const defaultPractices: BestPractice[] = [
    {
      name: 'Type annotations',
      status: 'adopted',
      description: 'Using explicit type annotations',
      evidence: 'Found in 95% of functions',
    },
    {
      name: 'Error handling',
      status: 'partial',
      description: 'Some functions lack error handling',
    },
    {
      name: 'Unit tests',
      status: 'missing',
      description: 'No unit tests detected',
    },
  ]

  return {
    language: 'TypeScript',
    namingConventions: defaultNaming,
    formatting: defaultFormatting,
    bestPractices: defaultPractices,
    summary: 'TypeScript codebase with consistent naming conventions',
    ...overrides,
  }
}

describe('DocGenerator', () => {
  let generator: DocGenerator
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(process.cwd(), `test-doc-generator-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    generator = new DocGenerator(testDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('generateArchitectureDoc', () => {
    it('should generate architecture document for empty project', async () => {
      const architecture = createMockArchitecture({
        structure: {
          root: '/empty-project',
          directories: [],
          maxDepth: 0,
          totalFiles: 0,
          totalDirs: 0,
        },
      })

      await generator.generateArchitectureDoc(architecture)

      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('# Project Architecture')
      expect(content).toContain('empty project')
      expect(content).toContain('No files have been detected')
    })

    it('should generate architecture document for single-file project', async () => {
      const architecture = createMockArchitecture({
        structure: {
          root: '/single-file-project',
          directories: [],
          maxDepth: 0,
          totalFiles: 1,
          totalDirs: 0,
        },
      })

      await generator.generateArchitectureDoc(architecture)

      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('# Project Architecture')
      expect(content).toContain('single-file project')
      expect(content).toContain('Total Files**: 1')
    })

    it('should generate full architecture document for normal project', async () => {
      const directoryNodes: DirectoryNode[] = [
        {
          name: 'src',
          path: '/project/src',
          type: 'directory',
          children: [
            { name: 'core', path: '/project/src/core', type: 'directory', children: [] },
            { name: 'utils', path: '/project/src/utils', type: 'directory', children: [] },
          ],
        },
        {
          name: 'tests',
          path: '/project/tests',
          type: 'directory',
          children: [],
        },
      ]

      const modules: ModuleInfo[] = [
        {
          name: 'core',
          path: 'src/core',
          type: 'core',
          fileCount: 5,
          dependencies: [],
        },
        {
          name: 'utils',
          path: 'src/utils',
          type: 'util',
          fileCount: 3,
          dependencies: ['core'],
        },
      ]

      const layers: LayerInfo[] = [
        {
          name: 'Core',
          directories: ['src/core'],
          purpose: 'Core business logic',
        },
      ]

      const architecture = createMockArchitecture({
        structure: {
          root: '/project',
          directories: directoryNodes,
          maxDepth: 3,
          totalFiles: 20,
          totalDirs: 5,
        },
        structureScore: {
          total: 75,
          directory: 25,
          config: 20,
          organization: 20,
          documentation: 10,
          level: 'clear',
        },
        modules,
        entryPoints: ['src/index.ts', 'src/cli.ts'],
        layers,
      })

      await generator.generateArchitectureDoc(architecture)

      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('# Project Architecture')
      expect(content).toContain('Structure Score**: 75/100')
      expect(content).toContain('Total Files**: 20')
      expect(content).toContain('Total Directories**: 5')
      expect(content).toContain('Structure Score Breakdown')
      expect(content).toContain('Technology Stack')
      expect(content).toContain('TypeScript')
      expect(content).toContain('Module Structure')
      expect(content).toContain('Entry Points')
      expect(content).toContain('Architecture Layers')
      expect(content).toContain('Directory Tree')
    })

    it('should handle architecture with no frameworks', async () => {
      const architecture = createMockArchitecture({
        structure: {
          root: '/project',
          directories: [],
          maxDepth: 2,
          totalFiles: 10,
          totalDirs: 3,
        },
        techStack: {
          languages: [{ name: 'Python', percentage: 100, fileCount: 10, extensions: ['.py'] }],
          frameworks: [],
          libraries: [],
          tools: [],
          packageManager: null,
          buildTool: null,
          testFramework: null,
        },
      })

      await generator.generateArchitectureDoc(architecture)

      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('No major frameworks detected')
      expect(content).toContain('Package Manager**: Not detected')
    })

    it('should handle architecture with no modules', async () => {
      const architecture = createMockArchitecture({
        structure: {
          root: '/project',
          directories: [],
          maxDepth: 1,
          totalFiles: 5,
          totalDirs: 1,
        },
        modules: [],
        entryPoints: [],
        layers: [],
      })

      await generator.generateArchitectureDoc(architecture)

      const docPath = path.join(testDir, 'architecture.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('No standard modules detected')
      expect(content).toContain('No standard entry points detected')
      expect(content).toContain('No distinct layers detected')
    })
  })

  describe('renderDirectoryTree', () => {
    it('should return empty string for empty nodes', () => {
      const result = generator.renderDirectoryTree([], 0)
      expect(result).toBe('')
    })

    it('should render single level directory tree', () => {
      const nodes: DirectoryNode[] = [
        { name: 'src', path: '/src', type: 'directory', children: [] },
        { name: 'tests', path: '/tests', type: 'directory', children: [] },
      ]

      const result = generator.renderDirectoryTree(nodes, 0)
      expect(result).toContain('src/')
      expect(result).toContain('tests/')
    })

    it('should render nested directory tree', () => {
      const nodes: DirectoryNode[] = [
        {
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            {
              name: 'core',
              path: '/src/core',
              type: 'directory',
              children: [],
            },
            {
              name: 'utils',
              path: '/src/utils',
              type: 'directory',
              children: [],
            },
          ],
        },
      ]

      const result = generator.renderDirectoryTree(nodes, 0)
      expect(result).toContain('src/')
      expect(result).toContain('core/')
      expect(result).toContain('utils/')
    })

    it('should limit depth of directory tree', () => {
      const nodes: DirectoryNode[] = [
        {
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            {
              name: 'core',
              path: '/src/core',
              type: 'directory',
              children: [
                {
                  name: 'deep',
                  path: '/src/core/deep',
                  type: 'directory',
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      // At depth 3, children should not be rendered
      const result = generator.renderDirectoryTree(nodes, 3)
      expect(result).toContain('src/')
    })

    it('should show truncation message for many children', () => {
      const manyChildren: DirectoryNode[] = Array.from({ length: 15 }, (_, i) => ({
        name: `child${i}`,
        path: `/child${i}`,
        type: 'directory' as const,
        children: [],
      }))

      const nodes: DirectoryNode[] = [
        {
          name: 'src',
          path: '/src',
          type: 'directory',
          children: manyChildren,
        },
      ]

      const result = generator.renderDirectoryTree(nodes, 0)
      expect(result).toContain('...')
      expect(result).toContain('more')
    })
  })

  describe('generateCodeStyleDoc', () => {
    it('should not create file for empty styles array', async () => {
      await generator.generateCodeStyleDoc([])

      const docPath = path.join(testDir, 'code-style.md')
      const exists = await fs.access(docPath).then(() => true).catch(() => false)
      expect(exists).toBe(false)
    })

    it('should generate code style document with all sections', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('# Code Style Guide')
      expect(content).toContain('TypeScript')
      expect(content).toContain('Naming Conventions')
      expect(content).toContain('Formatting')
      expect(content).toContain('Best Practices')
      expect(content).toContain('Recommendations')
    })

    it('should include naming convention details', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('variable')
      expect(content).toContain('camelCase')
      expect(content).toContain('95%')
      expect(content).toContain('userName')
    })

    it('should include formatting details', async () => {
      const styles: CodeStyle[] = [
        createMockCodeStyle({
          formatting: {
            indent: 'space',
            indentSize: 2,
            semicolons: true,
            quotes: 'single',
            trailingComma: true,
          },
        }),
      ]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Indent')
      expect(content).toContain('space')
      expect(content).toContain('2 spaces')
      expect(content).toContain('Semicolons')
      expect(content).toContain('Yes')
      expect(content).toContain('Quotes')
      expect(content).toContain('single')
    })

    it('should show adopted practices with checkmark', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Type annotations')
      expect(content).toContain('adopted')
    })

    it('should show partial practices with warning', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Error handling')
      expect(content).toContain('partial')
    })

    it('should show missing practices with x', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Unit tests')
      expect(content).toContain('missing')
    })

    it('should generate recommendations for missing practices', async () => {
      const styles: CodeStyle[] = [createMockCodeStyle()]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Recommendations')
      expect(content).toContain('Consider adopting')
      expect(content).toContain('Unit tests')
    })

    it('should show positive message when all practices adopted', async () => {
      const styles: CodeStyle[] = [
        createMockCodeStyle({
          bestPractices: [
            {
              name: 'Type annotations',
              status: 'adopted',
              description: 'Using explicit type annotations',
            },
            {
              name: 'Error handling',
              status: 'adopted',
              description: 'All functions have error handling',
            },
          ],
        }),
      ]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('All detected best practices are adopted')
    })

    it('should handle multiple languages', async () => {
      const styles: CodeStyle[] = [
        createMockCodeStyle({ language: 'TypeScript' }),
        createMockCodeStyle({
          language: 'Python',
          namingConventions: [
            {
              type: 'variable',
              style: 'snake_case',
              consistency: 0.9,
              examples: ['user_name', 'page_count'],
            },
          ],
          formatting: {
            indent: 'space',
            indentSize: 4,
            semicolons: false,
            quotes: 'double',
            trailingComma: false,
          },
          bestPractices: [],
          summary: 'Python codebase following PEP 8',
        }),
      ]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('## TypeScript')
      expect(content).toContain('## Python')
      expect(content).toContain('snake_case')
      expect(content).toContain('PEP 8')
    })

    it('should include evidence when available', async () => {
      const styles: CodeStyle[] = [
        createMockCodeStyle({
          bestPractices: [
            {
              name: 'Type annotations',
              status: 'adopted',
              description: 'Using explicit type annotations',
              evidence: 'Found in 95% of functions',
            },
          ],
        }),
      ]

      await generator.generateCodeStyleDoc(styles)

      const docPath = path.join(testDir, 'code-style.md')
      const content = await fs.readFile(docPath, 'utf-8')
      expect(content).toContain('Found in 95% of functions')
    })
  })

  describe('error handling', () => {
    it('should handle invalid output directory gracefully', async () => {
      const invalidGenerator = new DocGenerator('/nonexistent/path/that/does/not/exist')

      const architecture = createMockArchitecture()

      // Should not throw, but handle error gracefully
      await expect(invalidGenerator.generateArchitectureDoc(architecture)).resolves.toBeUndefined()
    })

    it('should handle code style doc with invalid directory', async () => {
      const invalidGenerator = new DocGenerator('/nonexistent/path/that/does/not/exist')

      const styles: CodeStyle[] = [createMockCodeStyle()]

      // Should not throw
      await expect(invalidGenerator.generateCodeStyleDoc(styles)).resolves.toBeUndefined()
    })
  })
})
