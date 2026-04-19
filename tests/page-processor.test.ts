import { describe, it, expect, beforeEach } from 'bun:test'
import { PageProcessor } from '../src/core/page-processor'

describe('PageProcessor', () => {
  let processor: PageProcessor

  beforeEach(() => {
    processor = new PageProcessor()
  })

  describe('SUPPORTED_EXTENSIONS', () => {
    it('should contain common code file extensions', () => {
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.md')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.ts')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.js')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.py')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.json')
    })

    it('should contain markup and style extensions', () => {
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.html')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.css')
      expect(PageProcessor.SUPPORTED_EXTENSIONS).toContain('.vue')
    })

    it('should be a frozen array', () => {
      expect(() => {
        (PageProcessor.SUPPORTED_EXTENSIONS as string[]).push('.newext')
      }).toThrow()
    })
  })

  describe('IGNORED_EXTENSIONS', () => {
    it('should contain binary and compiled file extensions', () => {
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.class')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.jar')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.exe')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.dll')
    })

    it('should contain temporary and backup file extensions', () => {
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.tmp')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.bak')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.log')
    })

    it('should contain minified and lock file extensions', () => {
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.min.js')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.min.css')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.lock')
      expect(PageProcessor.IGNORED_EXTENSIONS).toContain('.map')
    })

    it('should be a frozen array', () => {
      expect(() => {
        (PageProcessor.IGNORED_EXTENSIONS as string[]).push('.newext')
      }).toThrow()
    })
  })

  describe('isSupportedFile', () => {
    it('should return true for supported extensions', () => {
      expect(processor.isSupportedFile('test.md')).toBe(true)
      expect(processor.isSupportedFile('test.ts')).toBe(true)
      expect(processor.isSupportedFile('test.js')).toBe(true)
      expect(processor.isSupportedFile('test.py')).toBe(true)
      expect(processor.isSupportedFile('test.json')).toBe(true)
    })

    it('should return true for files with path', () => {
      expect(processor.isSupportedFile('/path/to/file.ts')).toBe(true)
      expect(processor.isSupportedFile('C:\\project\\src\\index.ts')).toBe(true)
    })

    it('should return false for unsupported extensions', () => {
      expect(processor.isSupportedFile('test.pdf')).toBe(false)
      expect(processor.isSupportedFile('test.png')).toBe(false)
      expect(processor.isSupportedFile('test.docx')).toBe(false)
    })

    it('should return false for files without extension', () => {
      expect(processor.isSupportedFile('README')).toBe(false)
      expect(processor.isSupportedFile('/path/to/file')).toBe(false)
    })

    it('should be case sensitive for extensions', () => {
      expect(processor.isSupportedFile('test.TS')).toBe(false)
      expect(processor.isSupportedFile('test.JS')).toBe(false)
    })
  })

  describe('isIgnoredFile', () => {
    it('should return true for ignored extensions', () => {
      expect(processor.isIgnoredFile('test.class')).toBe(true)
      expect(processor.isIgnoredFile('test.jar')).toBe(true)
      expect(processor.isIgnoredFile('test.exe')).toBe(true)
      expect(processor.isIgnoredFile('test.dll')).toBe(true)
    })

    it('should return true for minified files', () => {
      expect(processor.isIgnoredFile('app.min.js')).toBe(true)
      expect(processor.isIgnoredFile('style.min.css')).toBe(true)
    })

    it('should return true for lock files', () => {
      expect(processor.isIgnoredFile('yarn.lock')).toBe(true)
      expect(processor.isIgnoredFile('pnpm-lock.yaml')).toBe(false) // .yaml is extension
    })

    it('should return true for map files', () => {
      expect(processor.isIgnoredFile('app.js.map')).toBe(true)
      expect(processor.isIgnoredFile('style.css.map')).toBe(true)
    })

    it('should return true for temporary and backup files', () => {
      expect(processor.isIgnoredFile('test.tmp')).toBe(true)
      expect(processor.isIgnoredFile('test.bak')).toBe(true)
      expect(processor.isIgnoredFile('test.log')).toBe(true)
    })

    it('should return false for normal files', () => {
      expect(processor.isIgnoredFile('test.ts')).toBe(false)
      expect(processor.isIgnoredFile('test.js')).toBe(false)
      expect(processor.isIgnoredFile('test.md')).toBe(false)
    })

    it('should handle files with path', () => {
      expect(processor.isIgnoredFile('/path/to/test.min.js')).toBe(true)
      expect(processor.isIgnoredFile('C:\\project\\dist\\bundle.min.js')).toBe(true)
    })
  })

  describe('filterSensitiveContent', () => {
    it('should filter API keys', () => {
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = processor.filterSensitiveContent(content, 'config.ts')

      expect(result.warnings).toBeGreaterThanOrEqual(0)
      expect(result.content).not.toContain('sk-1234567890abcdef1234567890abcdef')
    })

    it('should filter passwords', () => {
      const content = 'password = "mySecretPassword123"'
      const result = processor.filterSensitiveContent(content, 'config.ts')

      expect(result.warnings).toBeGreaterThanOrEqual(0)
      expect(result.content).not.toContain('mySecretPassword123')
    })

    it('should skip test files', () => {
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = processor.filterSensitiveContent(content, 'config.test.ts')

      expect(result.warnings).toBe(0)
      expect(result.content).toBe(content)
    })

    it('should skip example files', () => {
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = processor.filterSensitiveContent(content, 'config.example.ts')

      expect(result.warnings).toBe(0)
      expect(result.content).toBe(content)
    })

    it('should return unchanged content for clean files', () => {
      const content = 'const x = 1 + 2'
      const result = processor.filterSensitiveContent(content, 'clean.ts')

      expect(result.content).toBe(content)
      expect(result.warnings).toBe(0)
    })

    it('should handle empty content', () => {
      const result = processor.filterSensitiveContent('', 'empty.ts')

      expect(result.content).toBe('')
      expect(result.warnings).toBe(0)
    })
  })

  describe('generatePageContent', () => {
    it('should generate page content with file name as title', () => {
      const sourceContent = 'line1\nline2\nline3'
      const result = processor.generatePageContent(sourceContent, 'test.ts')

      expect(result).toContain('# test.ts')
      expect(result).toContain('## Summary')
      expect(result).toContain('## Content Preview')
    })

    it('should include content preview', () => {
      const sourceContent = 'const x = 1\nconst y = 2'
      const result = processor.generatePageContent(sourceContent, 'utils.ts')

      expect(result).toContain('const x = 1')
      expect(result).toContain('const y = 2')
    })

    it('should limit preview to 50 lines', () => {
      const lines = Array(100).fill('line content')
      const sourceContent = lines.join('\n')
      const result = processor.generatePageContent(sourceContent, 'large.ts')

      const previewLines = result.split('\n').filter(line => line === 'line content')
      expect(previewLines.length).toBe(50)
    })

    it('should include related pages link', () => {
      const sourceContent = 'some content'
      const result = processor.generatePageContent(sourceContent, 'test.ts')

      expect(result).toContain('## Related Pages')
      expect(result).toContain('[[index]]')
    })

    it('should handle files with path', () => {
      const sourceContent = 'some content'
      const result = processor.generatePageContent(sourceContent, '/path/to/utils.ts')

      expect(result).toContain('# utils.ts')
    })

    it('should handle Windows paths', () => {
      const sourceContent = 'some content'
      const result = processor.generatePageContent(sourceContent, 'C:\\project\\src\\utils.ts')

      expect(result).toContain('# utils.ts')
    })

    it('should handle empty source content', () => {
      const result = processor.generatePageContent('', 'empty.ts')

      expect(result).toContain('# empty.ts')
      expect(result).toContain('## Summary')
    })

    it('should wrap content in code block', () => {
      const sourceContent = 'const x = 1'
      const result = processor.generatePageContent(sourceContent, 'test.ts')

      expect(result).toContain('```')
      expect(result).toContain('const x = 1')
    })
  })

  describe('Integration: isSupportedFile and isIgnoredFile', () => {
    it('should correctly identify processable files', () => {
      const testCases = [
        { file: 'app.ts', supported: true, ignored: false },
        { file: 'app.min.js', supported: true, ignored: true },
        { file: 'yarn.lock', supported: false, ignored: true },
        { file: 'test.pdf', supported: false, ignored: false },
        { file: 'test.exe', supported: false, ignored: true },
      ]

      for (const { file, supported, ignored } of testCases) {
        expect(processor.isSupportedFile(file)).toBe(supported)
        expect(processor.isIgnoredFile(file)).toBe(ignored)
      }
    })
  })
})
