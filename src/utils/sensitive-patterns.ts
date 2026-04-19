import type { SensitivePattern } from '../types/index.js'

export const DEFAULT_SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    id: 'api-key',
    name: 'API Key',
    description: 'API密钥，如 api_key=xxx',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'password',
    name: 'Password',
    description: '密码字段',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]{4,})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'bearer-token',
    name: 'Bearer Token',
    description: 'Bearer认证令牌',
    pattern: /Bearer\s+([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'jwt',
    name: 'JWT Token',
    description: 'JWT令牌',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'private-key',
    name: 'Private Key',
    description: '私钥文件内容',
    pattern: /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key',
    description: 'AWS访问密钥',
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[0-9A-Z]{16}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Key',
    description: 'AWS密钥',
    pattern: /(?:aws[_-]?secret[_-]?key|aws[_-]?secret)\s*[=:]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'connection-string',
    name: 'Database Connection String',
    description: '包含密码的数据库连接字符串',
    pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    description: 'GitHub个人访问令牌',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    description: 'Slack API令牌',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'generic-secret',
    name: 'Generic Secret',
    description: '通用密钥模式',
    pattern: /(?:secret|token|auth|key)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    severity: 'high',
    action: 'warn'
  }
]
