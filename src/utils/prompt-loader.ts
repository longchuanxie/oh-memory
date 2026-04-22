import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROMPTS_DIR = path.resolve(__dirname, '../../prompts')

const promptCache: Map<string, string> = new Map()

export async function loadPrompt(name: string): Promise<string> {
  const cached = promptCache.get(name)
  if (cached) return cached

  const filePath = path.join(PROMPTS_DIR, `${name}.txt`)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    promptCache.set(name, content)
    return content
  } catch (error) {
    throw new Error(`[oh-memory] Failed to load prompt "${name}": ${(error as Error).message}`)
  }
}

export function clearPromptCache(): void {
  promptCache.clear()
}
