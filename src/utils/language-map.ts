export type FileType = 'module' | 'concept' | 'config' | 'script' | 'style'

export interface LanguageInfo {
  language: string
  fileType: FileType
  extensions: readonly string[]
}

export const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  typescript: { language: 'typescript', fileType: 'module', extensions: ['.ts', '.tsx', '.mts', '.cts'] },
  javascript: { language: 'javascript', fileType: 'module', extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
  python: { language: 'python', fileType: 'module', extensions: ['.py', '.pyw', '.pyi'] },
  java: { language: 'java', fileType: 'module', extensions: ['.java'] },
  kotlin: { language: 'kotlin', fileType: 'module', extensions: ['.kt', '.kts'] },
  go: { language: 'go', fileType: 'module', extensions: ['.go'] },
  rust: { language: 'rust', fileType: 'module', extensions: ['.rs'] },
  c: { language: 'c', fileType: 'module', extensions: ['.c', '.h'] },
  cpp: { language: 'cpp', fileType: 'module', extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx', '.hh'] },
  csharp: { language: 'csharp', fileType: 'module', extensions: ['.cs'] },
  ruby: { language: 'ruby', fileType: 'module', extensions: ['.rb', '.rake', '.gemspec'] },
  php: { language: 'php', fileType: 'module', extensions: ['.php', '.phtml'] },
  swift: { language: 'swift', fileType: 'module', extensions: ['.swift'] },
  scala: { language: 'scala', fileType: 'module', extensions: ['.scala', '.sc'] },
  html: { language: 'html', fileType: 'concept', extensions: ['.html', '.htm'] },
  xml: { language: 'xml', fileType: 'config', extensions: ['.xml', '.svg', '.xsl', '.xslt', '.xsd'] },
  vue: { language: 'vue', fileType: 'module', extensions: ['.vue'] },
  svelte: { language: 'svelte', fileType: 'module', extensions: ['.svelte'] },
  css: { language: 'css', fileType: 'style', extensions: ['.css'] },
  scss: { language: 'scss', fileType: 'style', extensions: ['.scss'] },
  sass: { language: 'sass', fileType: 'style', extensions: ['.sass'] },
  less: { language: 'less', fileType: 'style', extensions: ['.less'] },
  json: { language: 'json', fileType: 'config', extensions: ['.json'] },
  yaml: { language: 'yaml', fileType: 'config', extensions: ['.yaml', '.yml'] },
  toml: { language: 'toml', fileType: 'config', extensions: ['.toml'] },
  ini: { language: 'ini', fileType: 'config', extensions: ['.ini', '.conf', '.cfg', '.properties', '.env'] },
  markdown: { language: 'markdown', fileType: 'concept', extensions: ['.md', '.markdown', '.mdx'] },
  shell: { language: 'shell', fileType: 'script', extensions: ['.sh', '.bash', '.zsh', '.ksh'] },
  powershell: { language: 'powershell', fileType: 'script', extensions: ['.ps1', '.psm1'] },
  sql: { language: 'sql', fileType: 'module', extensions: ['.sql'] },
  graphql: { language: 'graphql', fileType: 'config', extensions: ['.graphql', '.gql'] },
  proto: { language: 'protobuf', fileType: 'config', extensions: ['.proto'] },
  gradle: { language: 'gradle', fileType: 'config', extensions: ['.gradle', '.gradle.kts'] },
  dockerfile: { language: 'dockerfile', fileType: 'config', extensions: ['.dockerfile'] },
  rst: { language: 'rst', fileType: 'concept', extensions: ['.rst'] },
  adoc: { language: 'asciidoc', fileType: 'concept', extensions: ['.adoc', '.asciidoc'] },
  txt: { language: 'text', fileType: 'concept', extensions: ['.txt'] },
}

const extensionToLanguage: Map<string, LanguageInfo> = new Map()
for (const info of Object.values(LANGUAGE_MAP)) {
  for (const ext of info.extensions) {
    extensionToLanguage.set(ext, info)
  }
}

export function getLanguageInfo(ext: string): LanguageInfo | undefined {
  return extensionToLanguage.get(ext)
}

export function getLanguage(ext: string): string {
  return extensionToLanguage.get(ext)?.language ?? 'text'
}

export function getFileType(ext: string): FileType {
  return extensionToLanguage.get(ext)?.fileType ?? 'module'
}

export function isCodeFile(ext: string): boolean {
  return getFileType(ext) === 'module'
}

export function isSupportedExtension(ext: string): boolean {
  return extensionToLanguage.has(ext)
}

const CONFIG_DIRECTORY_PATTERNS = [
  'META-INF/services/',
  'META-INF/',
  '.github/',
  '.ci/',
  '.circleci/',
  '.gitlab/',
  '.jenkins/',
]

export function isConfigDirectoryFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return CONFIG_DIRECTORY_PATTERNS.some(pattern => normalized.includes(pattern))
}

export function getSupportedExtensions(): string[] {
  return [...extensionToLanguage.keys()]
}

export const PAGE_TYPE_TO_DIR: Record<string, string> = {
  module: 'modules',
  concept: 'concepts',
  config: 'configs',
  synthesis: 'synthesis',
}

export function getPageTypeDir(pageType: string): string {
  return PAGE_TYPE_TO_DIR[pageType] ?? 'modules'
}
