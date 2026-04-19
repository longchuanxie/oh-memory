import path from 'path'
import { promises as fs } from 'fs'

import { Logger } from '../utils/logger.js'

import type { ConnectionStats, KnowledgeGraph, PageFrontmatter, PageData } from '../types/index.js'

/**
 * IndexManager handles generation of graph index files
 */
export class IndexManager {
  private basePath: string
  private logger = Logger.getInstance()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  /**
   * Generate main index file (graph-index.md)
   */
  async generateMainIndex(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>,
    graph: KnowledgeGraph
  ): Promise<void> {
    try {
      const entities = [...pages.entries()].filter(([, p]) => p.metadata.type === 'entity')
      const concepts = [...pages.entries()].filter(([, p]) => p.metadata.type === 'concept')
      const sources = [...pages.entries()].filter(([, p]) => p.metadata.type === 'source')
      const synthesis = [...pages.entries()].filter(([, p]) => p.metadata.type === 'synthesis')

      const hubNodes = [...connectionStats.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)

      const recentUpdates = [...pages.entries()]
        .sort((a, b) => {
          const dateA = a[1].metadata.updated || a[1].metadata.date || ''
          const dateB = b[1].metadata.updated || b[1].metadata.date || ''
          return dateB.localeCompare(dateA)
        })
        .slice(0, 10)

      const content = `# Knowledge Graph Index

## Overview
- Total Nodes: ${pages.size}
- Total Edges: ${graph.edges.length}
- Last Updated: ${new Date().toISOString().split('T')[0]}

## Top Categories
- [[graph-entities|Entities (${entities.length} nodes)]]
- [[graph-concepts|Concepts (${concepts.length} nodes)]]
- [[graph-sources|Sources (${sources.length} nodes)]]
- [[graph-synthesis|Synthesis (${synthesis.length} nodes)]]

## Hub Nodes (High Connectivity)
${hubNodes.map(([id, stats]) => `- [[${id}]] - ${stats.total} connections`).join('\n')}

## Recent Updates
${recentUpdates.map(([id, p]) => `- [[${id}]] - Updated ${p.metadata.updated || p.metadata.date || 'unknown'}`).join('\n')}
`

      await fs.writeFile(
        path.join(this.basePath, 'graph-index.md'),
        content,
        'utf-8'
      )
    } catch (error) {
      this.logger.error('Failed to generate main index', error)
    }
  }

  /**
   * Generate layer index files (graph-entities.md, etc.)
   */
  async generateLayerIndexes(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>
  ): Promise<void> {
    const types = ['entity', 'concept', 'source', 'synthesis'] as const
    const typeNames = {
      entity: 'entities',
      concept: 'concepts',
      source: 'sources',
      synthesis: 'synthesis'
    }

    for (const type of types) {
      const typePages = [...pages.entries()].filter(([, p]) => p.metadata.type === type)

      const content = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Index

## Overview
- Total: ${typePages.length} nodes
- Last Updated: ${new Date().toISOString().split('T')[0]}

## All ${type.charAt(0).toUpperCase() + type.slice(1)}s
${typePages.map(([id, p]) => {
  const stats = connectionStats.get(id)
  const desc = p.metadata.summary?.description || p.metadata.description || ''
  return `- [[${id}]] - ${stats?.total || 0} connections${desc ? ` - ${desc.substring(0, 50)}...` : ''}`
}).join('\n')}

## By Module
${this.groupByModule(typePages, connectionStats)}
`

      try {
        await fs.writeFile(
          path.join(this.basePath, `graph-${typeNames[type]}.md`),
          content,
          'utf-8'
        )
      } catch (error) {
        this.logger.error(`Failed to generate ${type} index`, error)
      }
    }
  }

  /**
   * Group pages by module for layer index
   */
  private groupByModule(
    pages: [string, PageData][],
    connectionStats: Map<string, ConnectionStats>
  ): string {
    const modules = new Map<string, [string, PageData][]>()

    for (const [id, page] of pages) {
      const module = page.metadata.module || 'uncategorized'
      if (!modules.has(module)) {
        modules.set(module, [])
      }
      modules.get(module)!.push([id, page])
    }

    return [...modules.entries()]
      .map(([module, modulePages]) => {
        return `### ${module}\n${modulePages.map(([id]) => {
          const stats = connectionStats.get(id)
          return `- [[${id}]] - ${stats?.total || 0} connections`
        }).join('\n')}`
      })
      .join('\n\n')
  }
}
