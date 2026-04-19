import type {
  PageData,
  ContentSearchMatch,
  ContentSearchPageResult
} from '../types/index.js'

/**
 * 内容搜索选项
 */
export interface ContentSearchOptions {
  /** 最大结果数）*/
  limit?: number
  /** 上下文行）*/
  contextLines?: number
  /** 是否区分大小）*/
  caseSensitive?: boolean
  /** 最大上下文长度（字符数）*/
  maxContextLength?: number
}

/**
 * 内容搜索） * 负责在页面内容中搜索匹配） */
export class ContentSearcher {
  /** 每个搜索词的最大匹配数）*/
  private static readonly MAX_MATCHES_PER_TERM = 5

  /**
   * 在页面集合中搜索内容
   * @param pages - 页面数据数组
   * @param query - 搜索查询字符）   * @param options - 搜索选项
   * @returns 搜索结果数组，按匹配数量降序排列
   */
  async searchContent(
    pages: PageData[],
    query: string,
    options: ContentSearchOptions = {}
  ): Promise<ContentSearchPageResult[]> {
    const {
      limit = 10,
      contextLines = 2,
      caseSensitive = false,
      maxContextLength = 200
    } = options

    const searchTerms = this.tokenizeQuery(query)

    if (searchTerms.length === 0 || pages.length === 0) {
      return []
    }

    const results: ContentSearchPageResult[] = []

    for (const page of pages) {
      if (!page.content) {
        continue
      }

      const matches = this.findMatchesInContent(
        page.content,
        query,
        contextLines,
        caseSensitive,
        maxContextLength
      )

      if (matches.length > 0) {
        results.push({
          pageId: page.id || page.metadata.id,
          title: page.metadata.title,
          category: page.metadata.category || page.metadata.type,
          tags: page.metadata.tags,
          matches
        })
      }

      if (results.length >= limit) {
        break
      }
    }

    // 按匹配数量降序排）    results.sort((a, b) => b.matches.length - a.matches.length)

    return results.slice(0, limit)
  }

  /**
   * 在内容中查找匹配）   * @param content - 要搜索的内容
   * @param query - 搜索查询字符）   * @param contextLines - 上下文行数（前后各多少行）   * @param caseSensitive - 是否区分大小）   * @param maxContextLength - 最大上下文长度（字符数），默认200
   * @returns 匹配项数）   */
  findMatchesInContent(
    content: string,
    query: string,
    contextLines: number,
    caseSensitive: boolean,
    maxContextLength: number = 200
  ): ContentSearchMatch[] {
    if (!content || !query) {
      return []
    }

    const searchTerms = this.tokenizeQuery(query)

    if (searchTerms.length === 0) {
      return []
    }

    const lines = content.split('\n')
    const matches: ContentSearchMatch[] = []

    for (const term of searchTerms) {
      const searchLine = caseSensitive ? term : term.toLowerCase()

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineToSearch = caseSensitive ? line : line.toLowerCase()

        if (lineToSearch.includes(searchLine)) {
          const start = Math.max(0, i - contextLines)
          const end = Math.min(lines.length, i + contextLines + 1)
          let context = lines.slice(start, end).join('\n')

          // 截断过长的上下文
          if (context.length > maxContextLength) {
            context = context.substring(0, maxContextLength) + '...'
          }

          matches.push({
            term,
            context,
            lineNumber: i + 1
          })

          if (matches.length >= ContentSearcher.MAX_MATCHES_PER_TERM) {
            break
          }
        }
      }

      if (matches.length >= ContentSearcher.MAX_MATCHES_PER_TERM) {
        break
      }
    }

    return matches
  }

  /**
   * 对查询字符串进行分词
   * @param query - 查询字符）   * @returns 分词结果数组
   */
  private tokenizeQuery(query: string): string[] {
    const trimmed = query.trim()

    if (!trimmed) {
      return []
    }

    // 按空格分词，过滤空字符串
    return trimmed.split(/\s+/).filter(token => token.length > 0)
  }
}
