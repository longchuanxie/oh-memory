export interface KnowledgeNode {
  id: string
  title: string
  path: string
  type: 'module' | 'concept' | 'config' | 'synthesis'
  tags: string[]
  lastUpdated: string
  description?: string
  sourceLocations?: SourceLocation[]
  primarySource?: string
}

export interface SourceLocation {
  path: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  description?: string
}

export interface KnowledgeEdge {
  from: string
  to: string
  type: 'depends-on' | 'used-by' | 'implements' | 'references' | 'relates-to' | 'part-of'
  context?: string
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}
