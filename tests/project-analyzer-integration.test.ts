import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ProjectAnalyzer } from '../src/core/project-analyzer'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('ProjectAnalyzer Integration', () => {
  let analyzer: ProjectAnalyzer
  let testDir: string
  let memoryDir: string

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `oh-memory-analyzer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    memoryDir = path.join(testDir, '.memory')
    await fs.mkdir(memoryDir, { recursive: true })
    analyzer = new ProjectAnalyzer(testDir, memoryDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('analyze', () => {
    it('should analyze empty project', async () => {
      const result = await analyzer.analyze()

      expect(result).toBeDefined()
      expect(result.structure.totalFiles).toBe(0)
      expect(result.structureScore.total).toBe(0)
      expect(result.structureScore.level).toBe('messy')
    })

    it('should analyze single file project', async () => {
      const testFile = path.join(testDir, 'index.ts')
      await fs.writeFile(testFile, 'export const test = 1', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(1)
      expect(result.structureScore.total).toBe(10)
    })

    it('should analyze project with src directory', async () => {
      const srcDir = path.join(testDir, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.writeFile(path.join(srcDir, 'index.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(1)
    })

    it('should detect directory structure', async () => {
      const dirs = ['src', 'tests', 'docs']
      for (const dir of dirs) {
        const dirPath = path.join(testDir, dir)
        await fs.mkdir(dirPath, { recursive: true })
        await fs.writeFile(path.join(dirPath, 'index.ts'), 'export {}', 'utf-8')
      }

      const result = await analyzer.analyze()

      expect(result.structure.totalDirs).toBe(3)
      expect(result.structure.directories.length).toBeGreaterThan(0)
    })

    it('should calculate max depth correctly', async () => {
      const deepPath = path.join(testDir, 'src', 'core', 'utils', 'helpers')
      await fs.mkdir(deepPath, { recursive: true })
      await fs.writeFile(path.join(deepPath, 'util.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.maxDepth).toBeGreaterThanOrEqual(4)
    })

    it('should ignore node_modules', async () => {
      const nodeModules = path.join(testDir, 'node_modules', 'package')
      await fs.mkdir(nodeModules, { recursive: true })
      await fs.writeFile(path.join(nodeModules, 'index.js'), 'module.exports = {}', 'utf-8')

      const srcDir = path.join(testDir, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.writeFile(path.join(srcDir, 'index.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(1)
    })

    it('should ignore .git directory', async () => {
      const gitDir = path.join(testDir, '.git', 'objects')
      await fs.mkdir(gitDir, { recursive: true })
      await fs.writeFile(path.join(gitDir, 'file'), 'content', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(0)
    })

    it('should detect TypeScript files', async () => {
      await fs.writeFile(path.join(testDir, 'test.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'test.tsx'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      const tsLang = result.techStack.languages.find(l => l.name === 'TypeScript')
      expect(tsLang).toBeDefined()
      expect(tsLang!.fileCount).toBe(2)
    })

    it('should detect JavaScript files', async () => {
      await fs.writeFile(path.join(testDir, 'test.js'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'test.jsx'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      const jsLang = result.techStack.languages.find(l => l.name === 'JavaScript')
      expect(jsLang).toBeDefined()
      expect(jsLang!.fileCount).toBe(2)
    })

    it('should calculate language percentages', async () => {
      await fs.writeFile(path.join(testDir, 'a.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'b.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'c.go'), 'package main', 'utf-8')

      const result = await analyzer.analyze()

      const tsLang = result.techStack.languages.find(l => l.name === 'TypeScript')
      const goLang = result.techStack.languages.find(l => l.name === 'Go')

      expect(tsLang!.percentage).toBe(67)
      expect(goLang!.percentage).toBe(33)
    })

    it('should detect modules', async () => {
      const coreDir = path.join(testDir, 'src', 'core')
      const utilsDir = path.join(testDir, 'src', 'utils')
      await fs.mkdir(coreDir, { recursive: true })
      await fs.mkdir(utilsDir, { recursive: true })
      await fs.writeFile(path.join(coreDir, 'index.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(utilsDir, 'index.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.modules.length).toBeGreaterThan(0)
    })

    it('should set lastAnalyzed timestamp', async () => {
      const result = await analyzer.analyze()

      expect(result.lastAnalyzed).toBeDefined()
      expect(new Date(result.lastAnalyzed).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should return correct result structure', async () => {
      const result = await analyzer.analyze()

      expect(result).toHaveProperty('structure')
      expect(result).toHaveProperty('structureScore')
      expect(result).toHaveProperty('techStack')
      expect(result).toHaveProperty('modules')
      expect(result).toHaveProperty('entryPoints')
      expect(result).toHaveProperty('layers')
    })
  })

  describe('structureScore', () => {
    it('should classify clear projects', async () => {
      // Create a well-structured project
      const srcDir = path.join(testDir, 'src', 'core')
      const testsDir = path.join(testDir, 'tests')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.mkdir(testsDir, { recursive: true })

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test',
        devDependencies: { jest: '^29.0.0', eslint: '^8.0.0' }
      }), 'utf-8')
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test', 'utf-8')
      await fs.writeFile(path.join(srcDir, 'index.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testsDir, 'test.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structureScore.total).toBeGreaterThan(40)
    })

    it('should have correct score structure', async () => {
      const result = await analyzer.analyze()

      expect(result.structureScore).toHaveProperty('total')
      expect(result.structureScore).toHaveProperty('directory')
      expect(result.structureScore).toHaveProperty('config')
      expect(result.structureScore).toHaveProperty('organization')
      expect(result.structureScore).toHaveProperty('documentation')
      expect(result.structureScore).toHaveProperty('level')
    })
  })

  describe('needsReanalysis', () => {
    it('should return true for first analysis', async () => {
      const needs = await analyzer.needsReanalysis()

      expect(needs).toBe(true)
    })

    it('should return true after structure changes', async () => {
      await analyzer.analyze()

      // Add new file
      await fs.writeFile(path.join(testDir, 'new.ts'), 'export {}', 'utf-8')

      const newAnalyzer = new ProjectAnalyzer(testDir, memoryDir)
      const needs = await newAnalyzer.needsReanalysis()

      expect(needs).toBe(true)
    })
  })

  describe('analyzeCodeStyle', () => {
    it('should return empty array for empty project', async () => {
      const styles = await analyzer.analyzeCodeStyle()

      expect(styles).toHaveLength(0)
    })

    it('should analyze TypeScript code style', async () => {
      await fs.writeFile(path.join(testDir, 'test.ts'), `
        const myVariable = 1
        function myFunction() {}
        class MyClass {}
      `, 'utf-8')

      const styles = await analyzer.analyzeCodeStyle()

      const tsStyle = styles.find(s => s.language === 'TypeScript')
      expect(tsStyle).toBeDefined()
      expect(tsStyle!.namingConventions.length).toBeGreaterThan(0)
    })

    it('should detect naming conventions', async () => {
      await fs.writeFile(path.join(testDir, 'test.ts'), `
        const camelCaseVar = 1
        const anotherVar = 2
        function doSomething() {}
      `, 'utf-8')

      const styles = await analyzer.analyzeCodeStyle()

      const tsStyle = styles.find(s => s.language === 'TypeScript')
      expect(tsStyle).toBeDefined()

      const varConvention = tsStyle!.namingConventions.find(c => c.type === 'variable')
      expect(varConvention).toBeDefined()
      expect(varConvention!.style).toBe('camelCase')
    })

    it('should return correct style structure', async () => {
      await fs.writeFile(path.join(testDir, 'test.ts'), 'const test = 1', 'utf-8')

      const styles = await analyzer.analyzeCodeStyle()

      if (styles.length > 0) {
        const style = styles[0]
        expect(style).toHaveProperty('language')
        expect(style).toHaveProperty('namingConventions')
        expect(style).toHaveProperty('formatting')
        expect(style).toHaveProperty('bestPractices')
        expect(style).toHaveProperty('summary')
      }
    })
  })

  describe('loadCache', () => {
    it('should return null when no cache exists', async () => {
      const cache = await analyzer.loadCache()

      expect(cache).toBeNull()
    })
  })

  describe('layers', () => {
    it('should detect layers structure', async () => {
      const apiDir = path.join(testDir, 'src', 'api')
      await fs.mkdir(apiDir, { recursive: true })
      await fs.writeFile(path.join(apiDir, 'routes.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.layers).toBeDefined()
      expect(Array.isArray(result.layers)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle deeply nested directories', async () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'f')
      await fs.mkdir(deepPath, { recursive: true })
      await fs.writeFile(path.join(deepPath, 'deep.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(1)
    })

    it('should handle files with special characters in name', async () => {
      await fs.writeFile(path.join(testDir, 'test-file_v1.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.structure.totalFiles).toBe(1)
    })

    it('should handle mixed file types', async () => {
      await fs.writeFile(path.join(testDir, 'a.ts'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'b.js'), 'export {}', 'utf-8')
      await fs.writeFile(path.join(testDir, 'c.go'), 'package main', 'utf-8')
      await fs.writeFile(path.join(testDir, 'd.rs'), 'fn main() {}', 'utf-8')

      const result = await analyzer.analyze()

      expect(result.techStack.languages.length).toBe(4)
    })
  })

  describe('techStack', () => {
    it('should return correct tech stack structure', async () => {
      const result = await analyzer.analyze()

      expect(result.techStack).toHaveProperty('languages')
      expect(result.techStack).toHaveProperty('frameworks')
      expect(result.techStack).toHaveProperty('libraries')
      expect(result.techStack).toHaveProperty('tools')
      expect(result.techStack).toHaveProperty('packageManager')
      expect(result.techStack).toHaveProperty('buildTool')
      expect(result.techStack).toHaveProperty('testFramework')
    })

    it('should detect languages with correct structure', async () => {
      await fs.writeFile(path.join(testDir, 'test.ts'), 'export {}', 'utf-8')

      const result = await analyzer.analyze()

      const tsLang = result.techStack.languages[0]
      if (tsLang) {
        expect(tsLang).toHaveProperty('name')
        expect(tsLang).toHaveProperty('percentage')
        expect(tsLang).toHaveProperty('fileCount')
        expect(tsLang).toHaveProperty('extensions')
      }
    })
  })
})
