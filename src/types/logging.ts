/**
 * Log levels supported by the logging system
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log entry structure
 */
export interface LogEntry {
  /** ISO timestamp of the log entry */
  timestamp: string
  /** Log level */
  level: LogLevel
  /** Log message */
  message: string
  /** Log prefix (e.g., '[oh-memory]') */
  prefix: string
  /** Optional context object */
  context?: Record<string, unknown>
  /** Optional trace ID for request tracking */
  traceId?: string
}

/**
 * Transport interface for log output
 */
export interface LogTransport {
  /**
   * Write a log entry to the transport
   * @param entry - The log entry to write
   */
  write(entry: LogEntry): void
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel
  /** Log transports to use */
  transports?: LogTransport[]
  /** Optional trace ID for request tracking */
  traceId?: string
  /** Log prefix */
  prefix?: string
}
