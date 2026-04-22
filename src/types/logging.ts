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

  /**
   * Close the transport and release resources
   */
  close?(): void | Promise<void>
}

/**
 * File transport configuration
 */
export interface FileTransportOptions {
  /** Log file directory path */
  logDir: string
  /** Maximum log file size in bytes (default: 5MB) */
  maxSize?: number
  /** Maximum number of rotated log files to keep (default: 5) */
  maxFiles?: number
  /** Minimum log level for this transport (default: 'info') */
  level?: LogLevel
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
  /** Enable file logging to .memory/logs/ */
  fileLogging?: boolean
  /** Log file directory (default: .memory/logs) */
  logDir?: string
  /** Maximum log file size in bytes (default: 5MB) */
  maxLogSize?: number
  /** Maximum number of rotated log files (default: 5) */
  maxLogFiles?: number
}
