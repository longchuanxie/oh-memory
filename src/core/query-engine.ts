import type { KnowledgeGraph, KnowledgeNode } from '../types/index.js'

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string
  score: number
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  type: 'entity' | 'concept' | 'source' | 'synthesis' | 'all'
  limit?: number
}

/**
 * 查询引擎
 * 负责知识图谱的搜索和查询功能
 */
export class QueryEngine {
  /**
   * 对查询字符串进行分词
   * @param query - 查询字符串
   * @returns 分词结果数组
   */
  tokenizeQuery(query: string): string[] {
    const lower = query.toLowerCase().trim()

    if (!lower) {
      return []
    }

    // 按空格分词，过滤空字符串
    const tokens = lower.split(/\s+/).filter(token => token.length > 0)

    return tokens
  }

  /**
   * 搜索知识图谱节点
   * @param graph - 知识图谱
   * @param query - 查询字符串
   * @param options - 搜索选项
   * @returns 搜索结果数组，按相关性分数降序排列
   */
  search(graph: KnowledgeGraph, query: string, options: SearchOptions): SearchResult[] {
    // 处理空查询
    if (!query || query.trim().length === 0) {
      return []
    }

    // 分词
    const tokens = this.tokenizeQuery(query)

    if (tokens.length === 0) {
      return []
    }

    // 过滤节点
    let nodes = graph.nodes

    // 类型过滤
    if (options.type !== 'all') {
      nodes = nodes.filter(node => node.type === options.type)
    }

    // 计算每个节点的匹配分数
    const scoredNodes = nodes
      .map(node => ({
        id: node.id,
        score: this.calculateMatchScore(node, tokens)
      }))
      .filter(result => result.score > 0)

    // 按分数降序排列
    scoredNodes.sort((a, b) => b.score - a.score)

    // 应用limit
    if (options.limit !== undefined && options.limit > 0) {
      return scoredNodes.slice(0, options.limit)
    }

    return scoredNodes
  }

  /**
   * 计算节点与搜索词的匹配分数
   * @param node - 知识节点
   * @param searchTerms - 搜索词数组
   * @returns 匹配分数
   */
  private calculateMatchScore(node: KnowledgeNode, searchTerms: string[]): number {
    let score = 0

    for (const term of searchTerms) {
      // 标题匹配（2分）
      if (node.title.toLowerCase().includes(term)) {
        score += 2
      }

      // 标签匹配（1分）
      if (node.tags.some(tag => tag.toLowerCase().includes(term))) {
        score += 1
      }
    }

    return score
  }
}
