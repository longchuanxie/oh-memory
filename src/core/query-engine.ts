import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../types/index.js'

export interface SearchResult {
  node: KnowledgeNode
  score: number
  matchedFields: string[]
}

export interface SearchOptions {
  type?: 'module' | 'concept' | 'config' | 'synthesis' | 'all'
  limit?: number
  includeEdges?: boolean
}

export interface GraphTraversalResult {
  node: KnowledgeNode
  edges: KnowledgeEdge[]
  neighbors: KnowledgeNode[]
  depth: number
}

export interface QueryContext {
  query: string
  results: SearchResult[]
  traversalPaths: GraphTraversalResult[]
  summary: string
}

export class QueryEngine {
  search(graph: KnowledgeGraph, query: string, options: SearchOptions = {}): SearchResult[] {
    if (!query?.trim()) return []

    const tokens = this.tokenize(query)
    if (tokens.length === 0) return []

    const typeFilter = options.type ?? 'all'
    let nodes = graph.nodes

    if (typeFilter !== 'all') {
      nodes = nodes.filter(n => n.type === typeFilter)
    }

    const results = nodes
      .map(node => this.scoreNode(node, tokens))
      .filter((r): r is SearchResult => r !== null)

    results.sort((a, b) => b.score - a.score)

    return options.limit ? results.slice(0, options.limit) : results
  }

  findById(graph: KnowledgeGraph, id: string): KnowledgeNode | undefined {
    return graph.nodes.find(n => n.id === id)
  }

  findByPath(graph: KnowledgeGraph, filePath: string): KnowledgeNode | undefined {
    return graph.nodes.find(n =>
      n.path === filePath || n.primarySource === filePath
    )
  }

  getNeighbors(graph: KnowledgeGraph, nodeId: string, depth: number = 1): GraphTraversalResult[] {
    const results: GraphTraversalResult[] = []
    const visited = new Set<string>()
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.id) || current.depth > depth) continue
      visited.add(current.id)

      const node = this.findById(graph, current.id)
      if (!node) continue

      const edges = graph.edges.filter(
        e => e.from === current.id || e.to === current.id
      )

      const neighborIds = edges.map(e =>
        e.from === current.id ? e.to : e.from
      )

      const neighbors = graph.nodes.filter(n => neighborIds.includes(n.id))

      results.push({ node, edges, neighbors, depth: current.depth })

      if (current.depth < depth) {
        for (const neighborId of neighborIds) {
          if (!visited.has(neighborId)) {
            queue.push({ id: neighborId, depth: current.depth + 1 })
          }
        }
      }
    }

    return results
  }

  buildQueryContext(graph: KnowledgeGraph, query: string, options: SearchOptions = {}): QueryContext {
    const results = this.search(graph, query, options)

    const traversalPaths: GraphTraversalResult[] = []
    const traversedIds = new Set<string>()

    for (const result of results.slice(0, 5)) {
      if (!traversedIds.has(result.node.id)) {
        const traversal = this.getNeighbors(graph, result.node.id, 1)
        traversalPaths.push(...traversal)
        traversedIds.add(result.node.id)
      }
    }

    const summary = this.buildSummary(results, traversalPaths)

    return { query, results, traversalPaths, summary }
  }

  generateLLMQueryPrompt(context: QueryContext): string {
    const parts: string[] = []

    parts.push(`# Knowledge Base Query: "${context.query}"`)
    parts.push('')
    parts.push(`Found ${context.results.length} matching nodes.`)
    parts.push('')

    if (context.results.length > 0) {
      parts.push('## Top Results')
      for (const result of context.results.slice(0, 10)) {
        const fields = result.matchedFields.join(', ')
        parts.push(`- **${result.node.title}** (${result.node.type}) [score: ${result.score}, matched: ${fields}]`)
        if (result.node.description) {
          parts.push(`  ${result.node.description}`)
        }
        if (result.node.tags.length > 0) {
          parts.push(`  Tags: ${result.node.tags.join(', ')}`)
        }
      }
    }

    if (context.traversalPaths.length > 0) {
      parts.push('')
      parts.push('## Related Nodes')
      const seen = new Set<string>()
      for (const traversal of context.traversalPaths) {
        for (const neighbor of traversal.neighbors) {
          if (!seen.has(neighbor.id)) {
            seen.add(neighbor.id)
            parts.push(`- **${neighbor.title}** (${neighbor.type}) → connected via ${traversal.edges.map(e => e.type).join(', ')}`)
          }
        }
      }
    }

    return parts.join('\n')
  }

  private tokenize(query: string): string[] {
    return query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0)
  }

  private scoreNode(node: KnowledgeNode, tokens: string[]): SearchResult | null {
    let score = 0
    const matchedFields: string[] = []

    for (const token of tokens) {
      if (node.title.toLowerCase().includes(token)) {
        score += 3
        matchedFields.push('title')
      }

      if (node.id.toLowerCase().includes(token)) {
        score += 2
        matchedFields.push('id')
      }

      if (node.tags.some(tag => tag.toLowerCase().includes(token))) {
        score += 1.5
        matchedFields.push('tags')
      }

      if (node.description?.toLowerCase().includes(token)) {
        score += 1
        matchedFields.push('description')
      }

      if (node.path.toLowerCase().includes(token)) {
        score += 0.5
        matchedFields.push('path')
      }
    }

    if (score === 0) return null

    return {
      node,
      score,
      matchedFields: [...new Set(matchedFields)],
    }
  }

  private buildSummary(
    results: SearchResult[],
    traversals: GraphTraversalResult[]
  ): string {
    if (results.length === 0) return 'No matching results found.'

    const topResult = results[0]
    const neighborCount = traversals.reduce(
      (sum, t) => sum + t.neighbors.length, 0
    )

    return `Top match: "${topResult.node.title}" (score: ${topResult.score}). ${results.length} results, ${neighborCount} related nodes.`
  }
}
