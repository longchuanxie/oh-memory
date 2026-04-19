import crypto from 'crypto'
import path from 'path'

/**
 * ContentExtractor - 提取文件内容分析功能
 *
 * 从文件内容中提取关键字、函数、依赖、重要性等信息
 */
export class ContentExtractor {
  /**
   * 计算内容的MD5哈希值
   * @param content - 要计算哈希的内容
   * @returns 16字符的哈希字符串
   */
  calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  }

  /**
   * 根据文件扩展名获取语言类型
   * @param ext - 文件扩展名（包含点号，如 '.ts'）
   * @returns 语言名称
   */
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

  /**
   * 从内容中提取关键字
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 关键字数组（最多10个）
   */
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

  /**
   * 从内容中提取关键函数名
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 函数名数组（最多10个），如果没有则返回undefined
   */
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

  /**
   * 从内容中提取依赖项
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 依赖项数组（最多20个）
   */
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

  /**
   * 确定内容的重要性级别
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 重要性级别：'low' | 'medium' | 'high' | 'critical'
   */
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

  /**
   * 从文件路径中提取分类
   * @param filePath - 文件路径
   * @returns 分类名称，如果无法提取则返回undefined
   */
  extractCategory(filePath: string): string | undefined {
    const parts = filePath.split(/[/\\]/)
    const srcIndex = parts.findIndex(p => p === 'src')
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      return parts[srcIndex + 1]
    }
    return undefined
  }

  /**
   * 从文件路径中提取模块名
   * @param filePath - 文件路径
   * @returns 模块名，如果无法提取则返回undefined
   */
  extractModule(filePath: string): string | undefined {
    const parts = filePath.split(/[/\\]/)
    const srcIndex = parts.findIndex(p => p === 'src')
    if (srcIndex >= 0 && srcIndex + 2 < parts.length) {
      return parts[srcIndex + 1]
    }
    return undefined
  }

  /**
   * 从文件路径中提取层级
   * @param filePath - 文件路径
   * @returns 层级名称，如果无法提取则返回undefined
   */
  extractLayer(filePath: string): string | undefined {
    const parts = filePath.split(/[/\\]/)
    const layers = ['core', 'utils', 'types', 'api', 'services', 'components', 'pages']
    for (const layer of layers) {
      if (parts.includes(layer)) {
        return layer
      }
    }
    return undefined
  }

  /**
   * 从文件路径生成页面名称
   * @param filePath - 文件路径
   * @returns 页面名称（小写，特殊字符替换为连字符）
   */
  generatePageName(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath))
    return basename.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  /**
   * 根据文件路径确定页面类型（后备方案）
   * @param filePath - 文件路径
   * @returns 页面类型：'entity' | 'concept' | 'source'
   */
  determinePageTypeFallback(filePath: string): 'entity' | 'concept' | 'source' {
    const ext = path.extname(filePath)

    if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
      return 'entity'
    }

    const lowerPath = filePath.toLowerCase()
    if (lowerPath.includes('readme') || lowerPath.includes('docs')) {
      return 'concept'
    }

    return 'source'
  }

  /**
   * 从内容中提取标签
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 标签数组（最多5个）
   */
  extractTags(content: string, ext: string): string[] {
    const tags: string[] = []

    const keywords = content.match(/\b(function|class|interface|module|export|import)\b/gi)
    if (keywords) {
      tags.push(...[...new Set(keywords.map(k => k.toLowerCase()))])
    }

    return tags.slice(0, 5)
  }

  /**
   * 从内容中提取导入语句
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 导入模块路径数组
   */
  extractImports(content: string, ext: string): string[] {
    const imports: string[] = []

    const patterns: Record<string, RegExp> = {
      '.ts': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.tsx': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.js': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      '.jsx': /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    }

    const pattern = patterns[ext]
    if (pattern) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1])
      }
    }

    return imports
  }

  /**
   * 从内容中提取函数名
   * @param content - 文件内容
   * @param ext - 文件扩展名
   * @returns 函数名数组
   */
  extractFunctions(content: string, ext: string): string[] {
    const functions: string[] = []

    const patterns: Record<string, RegExp> = {
      '.ts': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)/g,
      '.tsx': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)/g,
      '.js': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g,
      '.jsx': /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g,
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

    return functions
  }

  /**
   * 从内容生成描述（取第一行）
   * @param content - 文件内容
   * @returns 描述文本（最多100字符）
   */
  generateDescription(content: string): string {
    const lines = content.split('\n').filter(l => l.trim())
    const firstLine = lines[0] || ''
    return firstLine.substring(0, 100) + (firstLine.length > 100 ? '...' : '')
  }
}
