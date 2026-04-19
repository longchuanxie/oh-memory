import type { KnowledgeGraph, KnowledgeEdge } from '../types/index.js'

export interface LinkIndex {
  forward: Map<string, Set<string>>
  backward: Map<string, Set<string>>
  contexts: Map<string, LinkContext[]>
}

export interface LinkContext {
  source: string
  target: string
  displayText?: string
  line: number
  context: string
}

export class LinkIndexManager {
  private index: LinkIndex = {
    forward: new Map(),
    backward: new Map(),
    contexts: new Map()
  }

  addLink(source: string, target: string, context?: LinkContext): void {
    if (!this.index.forward.has(source)) {
      this.index.forward.set(source, new Set())
    }
    this.index.forward.get(source)!.add(target)

    if (!this.index.backward.has(target)) {
      this.index.backward.set(target, new Set())
    }
    this.index.backward.get(target)!.add(source)

    if (context) {
      const key = `${source}->${target}`
      if (!this.index.contexts.has(key)) {
        this.index.contexts.set(key, [])
      }
      this.index.contexts.get(key)!.push(context)
    }
  }

  removeLink(source: string, target: string): void {
    this.index.forward.get(source)?.delete(target)
    this.index.backward.get(target)?.delete(source)
    this.index.contexts.delete(`${source}->${target}`)
  }

  getForwardLinks(source: string): string[] {
    return Array.from(this.index.forward.get(source) || [])
  }

  getBackwardLinks(target: string): string[] {
    return Array.from(this.index.backward.get(target) || [])
  }

  getLinkContext(source: string, target: string): LinkContext[] {
    return this.index.contexts.get(`${source}->${target}`) || []
  }

  getAllLinks(page: string): { forward: string[]; backward: string[] } {
    return {
      forward: this.getForwardLinks(page),
      backward: this.getBackwardLinks(page)
    }
  }

  getOrphanPages(): string[] {
    const orphans: string[] = []
    for (const [page] of this.index.forward) {
      if (!this.index.backward.has(page) && page !== 'index') {
        orphans.push(page)
      }
    }
    return orphans
  }

  getHubPages(topN: number = 10): Array<{ page: string; connections: number }> {
    const connections: Array<{ page: string; connections: number }> = []
    
    for (const [page, sources] of this.index.backward) {
      const forward = this.index.forward.get(page)?.size || 0
      connections.push({
        page,
        connections: sources.size + forward
      })
    }
    
    return connections
      .sort((a, b) => b.connections - a.connections)
      .slice(0, topN)
  }

  rebuildFromGraph(graph: KnowledgeGraph): void {
    this.index = {
      forward: new Map(),
      backward: new Map(),
      contexts: new Map()
    }

    for (const edge of graph.edges) {
      this.addLink(edge.from, edge.to)
    }
  }

  export(): { forward: Record<string, string[]>; backward: Record<string, string[]> } {
    return {
      forward: Object.fromEntries(
        Array.from(this.index.forward.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      backward: Object.fromEntries(
        Array.from(this.index.backward.entries()).map(([k, v]) => [k, Array.from(v)])
      )
    }
  }

  import(data: { forward: Record<string, string[]>; backward: Record<string, string[]> }): void {
    this.index.forward = new Map(
      Object.entries(data.forward).map(([k, v]) => [k, new Set(v)])
    )
    this.index.backward = new Map(
      Object.entries(data.backward).map(([k, v]) => [k, new Set(v)])
    )
  }

  clear(): void {
    this.index = {
      forward: new Map(),
      backward: new Map(),
      contexts: new Map()
    }
  }

  getStats(): { totalForward: number; totalBackward: number; orphanCount: number } {
    let totalForward = 0
    for (const targets of this.index.forward.values()) {
      totalForward += targets.size
    }

    let totalBackward = 0
    for (const sources of this.index.backward.values()) {
      totalBackward += sources.size
    }

    return {
      totalForward,
      totalBackward,
      orphanCount: this.getOrphanPages().length
    }
  }
}
