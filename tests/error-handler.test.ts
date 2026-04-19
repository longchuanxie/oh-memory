import { describe, it, expect } from 'bun:test'
import { ErrorHandler, OhMemoryError } from '../src/utils/error-handler'

describe('ErrorHandler', () => {
  describe('normalize', () => {
    it('should normalize Error to OhMemoryError', () => {
      const handler = new ErrorHandler()
      const error = new Error('Test error')

      const normalized = handler.normalize(error, 'TEST_ERROR', 'high')

      expect(normalized).toBeInstanceOf(OhMemoryError)
      expect(normalized.code).toBe('TEST_ERROR')
      expect(normalized.severity).toBe('high')
      expect(normalized.message).toBe('Test error')
    })

    it('should normalize string error', () => {
      const handler = new ErrorHandler()
      const normalized = handler.normalize('string error', 'UNKNOWN', 'medium')

      expect(normalized.message).toContain('string error')
      expect(normalized.code).toBe('UNKNOWN')
    })

    it('should normalize unknown error types', () => {
      const handler = new ErrorHandler()
      const normalized = handler.normalize({ foo: 'bar' }, 'PARSE_ERROR', 'low')

      expect(normalized.message).toContain('foo')
    })

    it('should preserve OhMemoryError instances', () => {
      const handler = new ErrorHandler()
      const original = new OhMemoryError('Test', 'TEST', 'high', { key: 'value' })

      const normalized = handler.normalize(original, 'OTHER', 'low')

      expect(normalized).toBe(original)
      expect(normalized.code).toBe('TEST')
      expect(normalized.severity).toBe('high')
    })
  })

  describe('handle', () => {
    it('should handle errors with context', () => {
      const handler = new ErrorHandler()
      const error = new OhMemoryError('Test', 'TEST', 'high', { file: 'test.ts' })

      const logs: Array<{ error: OhMemoryError; context: Record<string, unknown> }> = []
      handler.setLogger((log) => logs.push(log))

      handler.handle(error, { operation: 'test' })

      expect(logs.length).toBe(1)
      expect(logs[0].error).toBe(error)
      expect(logs[0].context.operation).toBe('test')
    })

    it('should log critical errors to console', () => {
      const handler = new ErrorHandler()
      const error = new OhMemoryError('Critical', 'CRITICAL', 'critical')

      const consoleErrors: string[] = []
      const originalError = console.error
      console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '))

      handler.handle(error, { operation: 'test' })

      console.error = originalError
      expect(consoleErrors.length).toBeGreaterThan(0)
      expect(consoleErrors[0]).toContain('[oh-memory]')
      expect(consoleErrors[0]).toContain('CRITICAL ERROR')
    })
  })
})

describe('OhMemoryError', () => {
  it('should create error with all properties', () => {
    const error = new OhMemoryError('Test message', 'TEST_CODE', 'high', { file: 'test.ts' })

    expect(error.message).toBe('Test message')
    expect(error.code).toBe('TEST_CODE')
    expect(error.severity).toBe('high')
    expect(error.context).toEqual({ file: 'test.ts' })
    expect(error.name).toBe('OhMemoryError')
  })

  it('should create error without context', () => {
    const error = new OhMemoryError('Test message', 'TEST_CODE', 'low')

    expect(error.message).toBe('Test message')
    expect(error.context).toEqual({})
  })

  it('should capture stack trace', () => {
    const error = new OhMemoryError('Test', 'TEST', 'medium')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('OhMemoryError')
  })

  it('should be throwable and catchable', () => {
    try {
      throw new OhMemoryError('Test error', 'TEST', 'high')
    } catch (e) {
      expect(e).toBeInstanceOf(OhMemoryError)
      expect((e as OhMemoryError).code).toBe('TEST')
    }
  })

  it('should convert to JSON for logging', () => {
    const error = new OhMemoryError('Test', 'TEST', 'high', { key: 'value' })
    const json = error.toJSON()

    expect(json.name).toBe('OhMemoryError')
    expect(json.message).toBe('Test')
    expect(json.code).toBe('TEST')
    expect(json.severity).toBe('high')
    expect(json.context).toEqual({ key: 'value' })
  })
})
