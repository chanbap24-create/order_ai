// 로깅 시스템

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

class Logger {
  private isDev: boolean;
  private isProd: boolean;

  constructor() {
    this.isDev = process.env.NODE_ENV === "development";
    this.isProd = process.env.NODE_ENV === "production";
  }

  private formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (meta && Object.keys(meta).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(meta, null, this.isDev ? 2 : 0)}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, meta?: LogMeta): void {
    if (this.isDev) {
      console.log(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: LogMeta): void {
    console.log(this.formatMessage("info", message, meta));
  }

  warn(message: string, meta?: LogMeta): void {
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(message: string, error?: unknown, meta?: LogMeta): void {
    const errorMeta: LogMeta = {
      ...meta,
    };

    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        name: error.name,
        ...(this.isDev && { stack: error.stack }),
      };
    } else if (error !== undefined) {
      errorMeta.error = error;
    }

    console.error(this.formatMessage("error", message, errorMeta));
  }
}

export const logger = new Logger();
