import type { LogLevel, LogEntry, LogTransport, LoggerOptions } from '../types/logging.js'

/**
 * Log level priority mapping
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Default log prefix
 */
const DEFAULT_PREFIX = '[oh-memory]'

/**
 * Console transport for logging to console
 */
export class ConsoleTransport implements LogTransport {
  /**
   * Write a log entry to the console
   * @param entry - The log entry to write
   */
  write(entry: LogEntry): void {
    const { timestamp, level, message, prefix, context } = entry
    const formattedMessage = `${prefix} ${message}`

    const output = context
      ? `${formattedMessage} ${JSON.stringify(context)}`
      : formattedMessage

    switch (level) {
      case 'error':
        console.error(`[${timestamp}] ${output}`)
        break
      case 'warn':
        console.warn(`[${timestamp}] ${output}`)
        break
      case 'debug':
        console.log(`[${timestamp}] [DEBUG] ${output}`)
        break
      default:
        console.log(`[${timestamp}] ${output}`)
    }
  }
}

/**
 * Structured logger with log levels and multiple transports
 */
export class Logger {
  private level: LogLevel
  private transports: LogTransport[]
  private traceId?: string
  private prefix: string
  private static instance: Logger

  /**
   * Create a new Logger instance
   * @param level - Minimum log level
   * @param transports - Log transports to use
   * @param traceId - Optional trace ID for request tracking
   * @param prefix - Log prefix
   */
  constructor(
    level: LogLevel = 'info',
    transports: LogTransport[] = [],
    traceId?: string,
    prefix: string = DEFAULT_PREFIX
  ) {
    this.level = level
    this.transports = transports
    this.traceId = traceId
    this.prefix = prefix
  }

  /**
   * Create a logger from options
   * @param options - Logger configuration options
   */
  static fromOptions(options: LoggerOptions = {}): Logger {
    return new Logger(
      options.level ?? 'info',
      options.transports ?? [],
      options.traceId,
      options.prefix ?? DEFAULT_PREFIX
    )
  }

  /**
   * Get the global logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger('info', [new ConsoleTransport()])
    }
    return Logger.instance
  }

  /**
   * Set the global logger instance
   * @param logger - Logger instance to set as global
   */
  static setInstance(logger: Logger): void {
    Logger.instance = logger
  }

  /**
   * Check if a log level should be logged
   * @param level - Level to check
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level]
  }

  /**
   * Create a log entry
   * @param level - Log level
   * @param message - Log message
   * @param context - Optional context
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      prefix: this.prefix,
      context,
      traceId: this.traceId
    }
  }

  /**
   * Write to all transports
   * @param entry - Log entry to write
   */
  private writeToTransports(entry: LogEntry): void {
    for (const transport of this.transports) {
      transport.write(entry)
    }
  }

  /**
   * Log a debug message
   * @param message - Log message
   * @param context - Optional context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    const entry = this.createEntry('debug', message, context)
    this.writeToTransports(entry)
  }

  /**
   * Log an info message
   * @param message - Log message
   * @param context - Optional context
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    const entry = this.createEntry('info', message, context)
    this.writeToTransports(entry)
  }

  /**
   * Log a warning message
   * @param message - Log message
   * @param context - Optional context
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    const entry = this.createEntry('warn', message, context)
    this.writeToTransports(entry)
  }

  /**
   * Log an error message
   * @param message - Log message
   * @param error - Optional error object
   * @param context - Optional context
   */
  error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog('error')) return

    const errorContext: Record<string, unknown> = { ...context }

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } else if (error !== undefined) {
      errorContext.error = error
    }

    const entry = this.createEntry('error', message, errorContext)
    this.writeToTransports(entry)
  }

  /**
   * Set the log level
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level
  }

  /**
   * Add a transport
   * @param transport - Transport to add
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport)
  }

  /**
   * Remove a transport
   * @param transport - Transport to remove
   */
  removeTransport(transport: LogTransport): void {
    const index = this.transports.indexOf(transport)
    if (index > -1) {
      this.transports.splice(index, 1)
    }
  }

  /**
   * Set the trace ID
   * @param traceId - Trace ID to set
   */
  setTraceId(traceId: string | undefined): void {
    this.traceId = traceId
  }

  /**
   * Create a child logger with a specific trace ID
   * @param traceId - Trace ID for the child logger
   */
  child(traceId: string): Logger {
    return new Logger(this.level, [...this.transports], traceId, this.prefix)
  }
}
