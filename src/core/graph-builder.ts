import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, ConnectionStats, PageData } from '../types/index.js'

const SECTION_TO_EDGE_TYPE: Record<string, KnowledgeEdge['type']> = {
  'depends on': 'depends-on',
  'used by': 'used-by',
  'implements': 'implements',
  'part of': 'part-of',
  'related concepts': 'relates-to',
  'references': 'relates-to',
  'imports': 'depends-on',
  'related': 'relates-to',
}

function classifyEdgeType(
  fromPage: PageData,
  fromSection: string | undefined,
  toPageId: string,
  allPages: Map<string, PageData>
): KnowledgeEdge['type'] {
  if (fromSection) {
    const lowerSection = fromSection.toLowerCase()
    for (const [key, edgeType] of Object.entries(SECTION_TO_EDGE_TYPE)) {
      if (lowerSection.includes(key)) {
        return edgeType
      }
    }
  }

  const fromType = fromPage.metadata.type
  const toPage = allPages.get(toPageId)
  const toType = toPage?.metadata.type

  if (fromType === 'module' && toType === 'concept') return 'part-of'
  if (fromType === 'concept' && toType === 'module') return 'relates-to'
  if (fromType === 'module' && toType === 'module') return 'depends-on'
  if (fromType === 'config' && toType === 'module') return 'relates-to'
  if (fromType === 'concept' && toType === 'concept') return 'relates-to'

  return 'relates-to'
}

export class GraphBuilder {
  build(pages: Map<string, PageData>): KnowledgeGraph {
    const nodes: KnowledgeNode[] = []
    const edges: KnowledgeEdge[] = []

    for (const [pageId, page] of pages) {
      nodes.push({
        id: pageId,
        title: page.metadata.title || pageId,
        path: page.metadata.source || `${pageId}.md`,
        type: page.metadata.type || 'module',
        tags: page.metadata.tags || [],
        lastUpdated: page.metadata.date || new Date().toISOString().split('T')[0],
        description: page.metadata.description,
      })

      for (const link of page.links) {
        const edgeType = classifyEdgeType(page, link.section, link.target, pages)
        edges.push({
          from: pageId,
          to: link.target,
          type: edgeType,
          context: link.section,
        })
      }
    }

    return { nodes, edges }
  }

  calculateConnectionStats(pages: Map<string, PageData>): Map<string, ConnectionStats> {
    const stats = new Map<string, ConnectionStats>()

    for (const [pageId] of pages) {
      stats.set(pageId, { inbound: 0, outbound: 0, total: 0 })
    }

    for (const [pageId, page] of pages) {
      const outbound = page.links.filter((link: { target: string }) => pages.has(link.target)).length
      const currentStats = stats.get(pageId)!
      currentStats.outbound = outbound
    }

    for (const [pageId, page] of pages) {
      for (const link of page.links) {
        if (pages.has(link.target)) {
          const linkStats = stats.get(link.target)!
          linkStats.inbound++
        }
      }
    }

    for (const [, pageStats] of stats) {
      pageStats.total = pageStats.inbound + pageStats.outbound
    }

    return stats
  }
}
