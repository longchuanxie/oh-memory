import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, ConnectionStats, PageData } from '../types/index.js'

export class GraphBuilder {
  /**
   * Build a knowledge graph from pages map
   */
  build(pages: Map<string, PageData>): KnowledgeGraph {
    const nodes: KnowledgeNode[] = []
    const edges: KnowledgeEdge[] = []

    for (const [pageId, page] of pages) {
      nodes.push({
        id: pageId,
        title: page.metadata.title || pageId,
        path: page.metadata.source?.path || `${pageId}.md`,
        type: page.metadata.type || 'entity',
        tags: page.metadata.tags || [],
        lastUpdated: page.metadata.date || new Date().toISOString().split('T')[0],
        description: page.metadata.description,
      })

      for (const link of page.links) {
        edges.push({
          from: pageId,
          to: link,
          type: 'references',
        })
      }
    }

    return { nodes, edges }
  }

  /**
   * Calculate connection statistics for all pages
   */
  calculateConnectionStats(pages: Map<string, PageData>): Map<string, ConnectionStats> {
    const stats = new Map<string, ConnectionStats>()

    // Initialize stats for all pages
    for (const [pageId] of pages) {
      stats.set(pageId, { inbound: 0, outbound: 0, total: 0 })
    }

    // Calculate outbound connections (only count links to existing pages)
    for (const [pageId, page] of pages) {
      const outbound = page.links.filter((link: string) => pages.has(link)).length
      const currentStats = stats.get(pageId)!
      currentStats.outbound = outbound
    }

    // Calculate inbound connections
    for (const [pageId, page] of pages) {
      for (const link of page.links) {
        if (pages.has(link)) {
          const linkStats = stats.get(link)!
          linkStats.inbound++
        }
      }
    }

    // Calculate total connections
    for (const [pageId, pageStats] of stats) {
      pageStats.total = pageStats.inbound + pageStats.outbound
    }

    return stats
  }
}
