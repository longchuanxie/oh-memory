import path from 'path'

import { SensitiveDataFilter } from '../utils/sensitive-filter.js'

/**
 * PageProcessor handles file processing logic for the knowledge base.
 * Responsible for determining file support, filtering sensitive content,
 * and generating page content from source files.
 */
export class PageProcessor {
  /**
   * List of supported file extensions for processing.
   * Includes common programming languages, markup, and configuration files.
   */
  public static readonly SUPPORTED_EXTENSIONS: readonly string[] = Object.freeze([
    '.md', '.txt', '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.go', '.rs', '.rb',
    '.json', '.yaml', '.yml', '.toml',
    '.sh', '.bash', '.zsh',
    '.sql',
    '.proto',
    '.graphql', '.gql',
    '.vue', '.svelte',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm',
  ])

  /**
   * List of ignored file extensions.
   * Includes binary files, compiled files, minified files, and temporary files.
   */
  public static readonly IGNORED_EXTENSIONS: readonly string[] = Object.freeze([
    '.class', '.jar', '.war', '.ear',
    '.dll', '.exe', '.so', '.dylib',
    '.o', '.obj', '.a', '.lib',
    '.pyc', '.pyo', '.pyd',
    '.swp', '.swo',
    '.log', '.tmp', '.temp',
    '.bak', '.backup', '.orig',
    '.min.js', '.min.css',
    '.map', '.lock',
  ])

  private readonly sensitiveFilter: SensitiveDataFilter

  constructor(sensitiveFilter?: SensitiveDataFilter) {
    this.sensitiveFilter = sensitiveFilter ?? new SensitiveDataFilter()
  }

  /**
   * Check if a file extension is supported for processing.
   *
   * @param filePath - The file path to check
   * @returns true if the file extension is supported, false otherwise
   */
  isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath)
    return PageProcessor.SUPPORTED_EXTENSIONS.includes(ext)
  }

  /**
   * Check if a file should be ignored during processing.
   * Checks both the file extension and the file name for patterns like .min.js
   *
   * @param filePath - The file path to check
   * @returns true if the file should be ignored, false otherwise
   */
  isIgnoredFile(filePath: string): boolean {
    const ext = path.extname(filePath)
    const fileName = path.basename(filePath)

    return PageProcessor.IGNORED_EXTENSIONS.some(
      ignoredExt => fileName.endsWith(ignoredExt) || ext === ignoredExt
    )
  }

  /**
   * Filter sensitive content from source content.
   * Uses SensitiveDataFilter to detect and redact sensitive data.
   *
   * @param content - The source content to filter
   * @param filePath - The file path (used for context detection)
   * @returns An object containing the filtered content and warning count
   */
  filterSensitiveContent(content: string, filePath: string): { content: string; warnings: number } {
    const filterResult = this.sensitiveFilter.filter(content, filePath, {
      timeout: 5000,
      skipTestFiles: true,
      skipExampleFiles: true,
      maxMatches: 100
    })

    return {
      content: filterResult.filtered,
      warnings: filterResult.redactedCount + filterResult.warningCount
    }
  }

  /**
   * Generate page content from source content.
   * Creates a markdown page with title, summary, content preview, and related pages.
   *
   * @param sourceContent - The source content to generate page from
   * @param filePath - The file path (used for title generation)
   * @returns The generated markdown content
   */
  generatePageContent(sourceContent: string, filePath: string): string {
    const lines = sourceContent.split('\n').slice(0, 50)
    const fileName = path.basename(filePath)

    return `# ${fileName}

## Summary

This page documents ${fileName}.

## Content Preview

\`\`\`
${lines.join('\n')}
\`\`\`

## Related Pages

- [[index]]
`
  }
}
