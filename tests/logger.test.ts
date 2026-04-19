import { describe, it, expect, beforeEach } from 'bun:test'
import { Logger, ConsoleTransport } from '../src/utils/logger'
import type { LogEntry, LogTransport } from '../src/types/logging'

describe('Logger', () => {
  let logger: Logger
  let logs: LogEntry[]
  let mockTransport: LogTransport

  beforeEach(() => {
    logs = []
    mockTransport = {
      write: (entry: LogEntry) => logs.push(entry)
    }
    logger = new Logger('info', [mockTransport])
  })

  it('should log info messages', () => {
    logger.info('Test message', { key: 'value' })

    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('info')
    expect(logs[0].message).toBe('Test message')
    expect(logs[0].context?.key).toBe('value')
  })

  it('should respect log level', () => {
    const debugLogger = new Logger('error', [mockTransport])

    debugLogger.info('This should not be logged')
    debugLogger.warn('This should not be logged either')
    debugLogger.error('This should be logged')

    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('error')
  })

  it('should include timestamp and prefix', () => {
    logger.info('Test')

    expect(logs[0].timestamp).toBeDefined()
    expect(logs[0].prefix).toBe('[oh-memory]')
  })

  it('should support multiple transports', () => {
    const logs2: LogEntry[] = []
    const transport2: LogTransport = {
      write: (entry) => logs2.push(entry)
    }

    const multiLogger = new Logger('info', [mockTransport, transport2])
    multiLogger.info('Test')

    expect(logs.length).toBe(1)
    expect(logs2.length).toBe(1)
  })

  it('should log errors with stack traces', () => {
    const error = new Error('Test error')
    logger.error('Something failed', error, { operation: 'test' })

    expect(logs[0].level).toBe('error')
    expect(logs[0].context?.error).toBeDefined()
    expect(logs[0].context?.operation).toBe('test')
  })

  it('should log debug messages', () => {
    const debugLogger = new Logger('debug', [mockTransport])
    debugLogger.debug('Debug message', { debug: true })

    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('debug')
    expect(logs[0].message).toBe('Debug message')
  })

  it('should log warn messages', () => {
    logger.warn('Warning message', { reason: 'test' })

    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('warn')
    expect(logs[0].message).toBe('Warning message')
  })

  it('should support traceId', () => {
    const traceLogger = new Logger('info', [mockTransport], 'trace-123')
    traceLogger.info('With trace')

    expect(logs[0].traceId).toBe('trace-123')
  })

  it('should not log below minimum level', () => {
    const errorLogger = new Logger('error', [mockTransport])

    errorLogger.debug('No debug')
    errorLogger.info('No info')
    errorLogger.warn('No warn')

    expect(logs.length).toBe(0)
  })
})

describe('ConsoleTransport', () => {
  it('should format log entries for console', () => {
    const entry: LogEntry = {
      timestamp: '2026-04-19T00:00:00.000Z',
      level: 'info',
      message: 'Test message',
      prefix: '[oh-memory]'
    }

    const transport = new ConsoleTransport()
    // Just verify it doesn't throw
    transport.write(entry)
  })

  it('should format error level with console.error', () => {
    const entry: LogEntry = {
      timestamp: '2026-04-19T00:00:00.000Z',
      level: 'error',
      message: 'Error message',
      prefix: '[oh-memory]'
    }

    const transport = new ConsoleTransport()
    transport.write(entry)
  })

  it('should format warn level with console.warn', () => {
    const entry: LogEntry = {
      timestamp: '2026-04-19T00:00:00.000Z',
      level: 'warn',
      message: 'Warning message',
      prefix: '[oh-memory]'
    }

    const transport = new ConsoleTransport()
    transport.write(entry)
  })

  it('should format context in output', () => {
    const entry: LogEntry = {
      timestamp: '2026-04-19T00:00:00.000Z',
      level: 'info',
      message: 'Test message',
      prefix: '[oh-memory]',
      context: { key: 'value', count: 42 }
    }

    const transport = new ConsoleTransport()
    transport.write(entry)
  })
})

describe('Logger singleton', () => {
  it('should provide global logger instance', () => {
    const globalLogger = Logger.getInstance()
    expect(globalLogger).toBeInstanceOf(Logger)
  })

  it('should allow setting global logger', () => {
    const customLogger = new Logger('debug', [])
    Logger.setInstance(customLogger)

    expect(Logger.getInstance()).toBe(customLogger)
  })
})

describe('Log level hierarchy', () => {
  it('should have correct level priority', () => {
    const levels = ['debug', 'info', 'warn', 'error']
    const logs: LogEntry[] = []
    const transport: LogTransport = { write: (entry) => logs.push(entry) }

    // Test each level
    for (let i = 0; i < levels.length; i++) {
      const currentLevel = levels[i] as 'debug' | 'info' | 'warn' | 'error'
      const logger = new Logger(currentLevel, [transport])

      logs.length = 0

      // Log at all levels
      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      // Should only log levels >= currentLevel
      expect(logs.length).toBe(levels.length - i)
    }
  })
})
