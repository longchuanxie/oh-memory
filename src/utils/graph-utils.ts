import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, PageFrontmatter } from '../types/index.js'

export function buildGraph(pages: Map<string, { links: string[]; metadata: PageFrontmatter }>): KnowledgeGraph {
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

export function findOrphanNodes(graph: KnowledgeGraph): string[] {
  const nodesWithInbound = new Set(graph.edges.map(e => e.to))
  const orphanNodes = graph.nodes.filter(n => !nodesWithInbound.has(n.id))
  return orphanNodes.map(n => n.id)
}

export function findBrokenLinks(graph: KnowledgeGraph): Array<{ from: string; to: string }> {
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  const brokenLinks: Array<{ from: string; to: string }> = []
  
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.to)) {
      brokenLinks.push({ from: edge.from, to: edge.to })
    }
  }
  
  return brokenLinks
}

export function findCycles(graph: KnowledgeGraph): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  
  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)
    
    const outgoingEdges = graph.edges.filter(e => e.from === nodeId)
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        dfs(edge.to, [...path])
      } else if (recursionStack.has(edge.to)) {
        const cycleStart = path.indexOf(edge.to)
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart))
        }
      }
    }
    
    recursionStack.delete(nodeId)
  }
  
  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, [])
    }
  }
  
  return cycles
}

export function getRelatedNodes(graph: KnowledgeGraph, nodeId: string, depth: number = 2): string[] {
  const related = new Set<string>()
  const queue: Array<{ id: string; level: number }> = [{ id: nodeId, level: 0 }]
  
  while (queue.length > 0) {
    const current = queue.shift()!
    
    if (current.level >= depth) {
      continue
    }
    
    const outgoingEdges = graph.edges.filter(e => e.from === current.id)
    const incomingEdges = graph.edges.filter(e => e.to === current.id)
    
    for (const edge of outgoingEdges) {
      if (!related.has(edge.to)) {
        related.add(edge.to)
        queue.push({ id: edge.to, level: current.level + 1 })
      }
    }
    
    for (const edge of incomingEdges) {
      if (!related.has(edge.from)) {
        related.add(edge.from)
        queue.push({ id: edge.from, level: current.level + 1 })
      }
    }
  }
  
  related.delete(nodeId)
  return Array.from(related)
}

export function searchNodes(graph: KnowledgeGraph, query: string): KnowledgeNode[] {
  const queryLower = query.toLowerCase()
  
  return graph.nodes.filter(node => {
    return (
      node.title.toLowerCase().includes(queryLower) ||
      node.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
      (node.description && node.description.toLowerCase().includes(queryLower))
    )
  })
}

export function exportToJSON(graph: KnowledgeGraph): string {
  return JSON.stringify(graph, null, 2)
}

export function exportToMermaid(graph: KnowledgeGraph): string {
  const lines: string[] = ['graph TD']
  
  for (const node of graph.nodes) {
    const label = node.title.replace(/"/g, "'")
    lines.push(`  ${node.id}["${label}"]`)
  }
  
  for (const edge of graph.edges) {
    lines.push(`  ${edge.from} --> ${edge.to}`)
  }
  
  return lines.join('\n')
}
