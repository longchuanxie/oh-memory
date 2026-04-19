export interface JumpProtocol {
  action: 'jump-to-source' | 'jump-to-knowledge' | 'list-targets'
  pageId: string
  targetPath?: string
  line?: number
  column?: number
}

export interface JumpResult {
  success: boolean
  message?: string
  actions?: Array<{
    title: string
    protocol: JumpProtocol
  }>
}

export const JUMP_COMMAND_PREFIX = 'memory-jump:'

export function encodeJumpProtocol(protocol: JumpProtocol): string {
  return `${JUMP_COMMAND_PREFIX}${Buffer.from(JSON.stringify(protocol)).toString('base64')}`
}

export function decodeJumpProtocol(encoded: string): JumpProtocol | null {
  if (!encoded.startsWith(JUMP_COMMAND_PREFIX)) {
    return null
  }
  
  try {
    const json = Buffer.from(encoded.slice(JUMP_COMMAND_PREFIX.length), 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export interface JumpAction {
  id: string
  title: string
  description?: string
  icon?: string
  protocol: JumpProtocol
}

export const DEFAULT_JUMP_ACTIONS: JumpAction[] = [
  {
    id: 'goto-source',
    title: '跳转到源代码',
    description: '打开源文件并定位到相关代码',
    icon: 'file-code',
    protocol: { action: 'jump-to-source', pageId: '' }
  },
  {
    id: 'goto-knowledge',
    title: '查看相关知识',
    description: '打开相关的知识页面',
    icon: 'book',
    protocol: { action: 'jump-to-knowledge', pageId: '' }
  },
  {
    id: 'list-targets',
    title: '列出所有跳转目标',
    description: '显示所有可跳转的位置',
    icon: 'list',
    protocol: { action: 'list-targets', pageId: '' }
  }
]
