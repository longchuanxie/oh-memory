import { describe, it, expect } from 'bun:test'
import { SensitiveDataFilter } from '../src/utils/sensitive-filter'

describe('SensitiveDataFilter', () => {
  const filter = new SensitiveDataFilter()

  describe('API Key Detection', () => {
    it('should detect API keys', () => {
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.filtered).toContain('[REDACTED:')
      expect(result.filtered).not.toContain('sk-1234567890abcdef1234567890abcdef')
    })

    it('should detect API keys with various formats', () => {
      const testCases = [
        'apiKey: "sk-1234567890abcdef1234567890abcdef"',
        'api-key = sk-1234567890abcdef1234567890abcdef',
        'API_KEY=sk-1234567890abcdef1234567890abcdef',
      ]
      
      for (const content of testCases) {
        const result = filter.filter(content)
        expect(result.matches.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Password Detection', () => {
    it('should detect passwords', () => {
      const content = 'password = "mySecretPassword123"'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.filtered).toContain('[REDACTED:')
    })

    it('should detect password variants', () => {
      const testCases = [
        'passwd: secret123',
        'pwd = "testpass"',
      ]
      
      for (const content of testCases) {
        const result = filter.filter(content)
        expect(result.matches.length).toBeGreaterThan(0)
      }
    })
  })

  describe('JWT Token Detection', () => {
    it('should detect JWT tokens', () => {
      const content = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.filtered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })
  })

  describe('AWS Key Detection', () => {
    it('should detect AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('should detect AWS secret keys', () => {
      const content = 'aws_secret_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
    })
  })

  describe('Private Key Detection', () => {
    it('should detect private keys', () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MbzYLdZ7ZvVy7F7V
-----END RSA PRIVATE KEY-----`
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.filtered).not.toContain('MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn')
    })
  })

  describe('Connection String Detection', () => {
    it('should detect database connection strings', () => {
      const testCases = [
        'mysql://user:password@localhost:3306/database',
        'postgres://admin:secret@db.example.com:5432/mydb',
        'mongodb://root:pass123@mongo.example.com:27017/db',
        'redis://user:password@redis.example.com:6379',
      ]
      
      for (const content of testCases) {
        const result = filter.filter(content)
        expect(result.matches.length).toBeGreaterThan(0)
      }
    })
  })

  describe('GitHub Token Detection', () => {
    it('should detect GitHub tokens', () => {
      const content = 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
    })
  })

  describe('Slack Token Detection', () => {
    it('should detect Slack tokens', () => {
      const content = 'SLACK_TOKEN=xoxb-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
    })
  })

  describe('Normal Code Handling', () => {
    it('should not filter normal code', () => {
      const content = `
function calculateSum(a: number, b: number): number {
  return a + b
}
export { calculateSum }
`
      const result = filter.filter(content)
      
      expect(result.matches.length).toBe(0)
      expect(result.filtered).toBe(content)
    })

    it('should not filter normal configuration', () => {
      const content = `
{
  "name": "my-project",
  "version": "1.0.0",
  "description": "A sample project"
}
`
      const result = filter.filter(content)
      
      expect(result.matches.length).toBe(0)
    })
  })

  describe('Line Number Preservation', () => {
    it('should preserve line numbers after filtering', () => {
      const content = `line1
api_key=secret1234567890abcdef
line3`
      const result = filter.filter(content)
      
      expect(result.matches[0].location.line).toBe(2)
    })
  })

  describe('Context-Aware Filtering', () => {
    it('should skip test files when configured', () => {
      const content = 'api_key=sk-test1234567890abcdef12345678'
      const result = filter.filter(content, '/src/auth.test.ts', {
        skipTestFiles: true
      })
      
      expect(result.matches.length).toBe(0)
      expect(result.filtered).toBe(content)
    })

    it('should skip spec files when configured', () => {
      const content = 'password = "testpassword"'
      const result = filter.filter(content, '/src/config.spec.ts', {
        skipTestFiles: true
      })
      
      expect(result.matches.length).toBe(0)
    })

    it('should skip files in __tests__ directory', () => {
      const content = 'api_key=sk-test1234567890abcdef12345678'
      const result = filter.filter(content, '/src/__tests__/utils.ts', {
        skipTestFiles: true
      })
      
      expect(result.matches.length).toBe(0)
    })

    it('should skip example files when configured', () => {
      const content = 'api_key=sk-example1234567890abcdef12345678'
      const result = filter.filter(content, '/examples/config.example.ts', {
        skipExampleFiles: true
      })
      
      expect(result.matches.length).toBe(0)
      expect(result.filtered).toBe(content)
    })

    it('should skip files in examples directory', () => {
      const content = 'password = "examplepassword"'
      const result = filter.filter(content, '/docs/examples/demo.ts', {
        skipExampleFiles: true
      })
      
      expect(result.matches.length).toBe(0)
    })
  })

  describe('Timeout Protection', () => {
    it('should respect timeout', () => {
      const largeContent = 'api_key=sk-test1234567890abcdef\n'.repeat(10000)
      const result = filter.filter(largeContent, undefined, {
        timeout: 100
      })
      
      expect(result).toBeDefined()
    })
  })

  describe('Max Matches Limit', () => {
    it('should respect maxMatches limit', () => {
      const content = `
api_key=sk-1234567890abcdef1234567890abcdef
password=test1234
api_key=sk-2234567890abcdef1234567890abcdef
password=test5678
`
      const result = filter.filter(content, undefined, {
        maxMatches: 2
      })
      
      expect(result.matches.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Filter Log', () => {
    it('should record filter log', () => {
      const filter = new SensitiveDataFilter()
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      filter.filter(content, '/src/config.ts')
      
      const log = filter.getFilterLog()
      expect(log.length).toBe(1)
      expect(log[0].file).toBe('/src/config.ts')
      expect(log[0].matches.length).toBeGreaterThan(0)
    })

    it('should record skipped files in log', () => {
      const filter = new SensitiveDataFilter()
      const content = 'api_key=sk-test1234567890abcdef12345678'
      filter.filter(content, '/src/auth.test.ts', { skipTestFiles: true })
      
      const log = filter.getFilterLog()
      expect(log.length).toBe(1)
      expect(log[0].skipped).toBe(true)
      expect(log[0].reason).toBe('test-file')
    })

    it('should clear log', () => {
      const filter = new SensitiveDataFilter()
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      filter.filter(content, '/src/config.ts')
      
      filter.clearLog()
      expect(filter.getFilterLog().length).toBe(0)
    })
  })

  describe('Custom Patterns', () => {
    it('should add custom patterns', () => {
      const filter = new SensitiveDataFilter()
      filter.addPattern({
        id: 'custom-key',
        name: 'Custom Key',
        description: 'Custom API key pattern',
        pattern: /CUSTOM_KEY_[A-Z0-9]{32}/g,
        severity: 'critical',
        action: 'redact'
      })
      
      const content = 'CUSTOM_KEY_ABCDEF1234567890ABCDEF1234567890'
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.filtered).toContain('[REDACTED:')
    })

    it('should remove patterns', () => {
      const filter = new SensitiveDataFilter()
      filter.removePattern('api-key')
      
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = filter.filter(content)
      
      const apiKeyMatch = result.matches.find(m => m.patternId === 'api-key')
      expect(apiKeyMatch).toBeUndefined()
    })
  })

  describe('Multiple Sensitive Items', () => {
    it('should handle multiple sensitive items in one file', () => {
      const content = `
const config = {
  apiKey: 'sk-1234567890abcdef1234567890abcdef',
  password: 'superSecretPassword',
  dbUrl: 'postgres://user:pass@localhost:5432/db',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
}
`
      const result = filter.filter(content)
      
      expect(result.matches.length).toBeGreaterThanOrEqual(4)
      expect(result.filtered).not.toContain('sk-1234567890abcdef')
      expect(result.filtered).not.toContain('superSecretPassword')
      expect(result.filtered).not.toContain('postgres://user:pass@localhost')
      expect(result.filtered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })
  })

  describe('Severity Levels', () => {
    it('should classify critical severity items', () => {
      const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
      const result = filter.filter(content)
      
      const criticalMatch = result.matches.find(m => m.severity === 'critical')
      expect(criticalMatch).toBeDefined()
    })

    it('should classify high severity items', () => {
      const content = 'secret = "abcdefghijklmnopqrstuvwxyz123456"'
      const result = filter.filter(content)
      
      const highMatch = result.matches.find(m => m.severity === 'high')
      expect(highMatch).toBeDefined()
    })
  })
})
