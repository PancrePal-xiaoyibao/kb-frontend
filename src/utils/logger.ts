import chalk from 'chalk';

// 日志级别枚举
export enum LogLevel {
  INFO = 'info',
  DEV = 'dev',
  WARN = 'warn',
  ERROR = 'error'
}

// 日志级别配置
const LOG_LEVELS = {
  [LogLevel.INFO]: { color: chalk.blue, symbol: 'ℹ', priority: 1 },
  [LogLevel.DEV]: { color: chalk.cyan, symbol: '🔧', priority: 2 },
  [LogLevel.WARN]: { color: chalk.yellow, symbol: '⚠', priority: 3 },
  [LogLevel.ERROR]: { color: chalk.red, symbol: '❌', priority: 4 }
};

// 日志配置接口
export interface LoggerConfig {
  level: LogLevel;
  enableTimestamp?: boolean;
  enableColors?: boolean;
  enableSymbols?: boolean;
  maxLevel?: LogLevel;
}

// 默认配置
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableTimestamp: true,
  enableColors: true,
  enableSymbols: true,
  maxLevel: LogLevel.ERROR
};

// 日志工具类
export class Logger {
  private config: LoggerConfig;
  private context?: string;

  constructor(config: Partial<LoggerConfig> = {}, context?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = context;
  }

  /**
   * 获取当前时间戳
   */
  private getTimestamp(): string {
    if (!this.config.enableTimestamp) return '';
    const now = new Date();
    return chalk.gray(`[${now.toISOString()}] `);
  }

  /**
   * 获取上下文信息
   */
  private getContext(): string {
    if (!this.context) return '';
    return chalk.magenta(`[${this.context}] `);
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const config = LOG_LEVELS[level];
    const timestamp = this.getTimestamp();
    const context = this.getContext();
    const symbol = this.config.enableSymbols ? `${config.symbol} ` : '';
    
    let formattedMessage = message;
    if (args.length > 0) {
      formattedMessage += ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
    }

    if (this.config.enableColors) {
      return `${timestamp}${context}${config.color(symbol)}${config.color(formattedMessage)}`;
    } else {
      return `${timestamp}${context}${symbol}${formattedMessage}`;
    }
  }

  /**
   * 检查是否应该输出该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.maxLevel) return true;
    return LOG_LEVELS[level].priority <= LOG_LEVELS[this.config.maxLevel].priority;
  }

  /**
   * 输出信息日志
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, ...args));
    }
  }

  /**
   * 输出开发调试日志
   */
  dev(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEV)) {
      console.log(this.formatMessage(LogLevel.DEV, message, ...args));
    }
  }

  /**
   * 输出警告日志
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, ...args));
    }
  }

  /**
   * 输出错误日志
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
    }
  }

  /**
   * 输出错误日志（包含错误堆栈）
   */
  errorWithStack(message: string, error: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMessage = `${message}: ${error.message}`;
      console.error(this.formatMessage(LogLevel.ERROR, errorMessage));
      if (error.stack) {
        console.error(chalk.red(error.stack));
      }
    }
  }

  /**
   * 创建子日志器（继承配置但可以设置不同的上下文）
   */
  child(context: string): Logger {
    return new Logger(this.config, context);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 输出分隔线
   */
  separator(char: string = '=', length: number = 50): void {
    const line = char.repeat(length);
    console.log(chalk.gray(line));
  }

  /**
   * 输出表格数据
   */
  table(data: any[]): void {
    if (data.length === 0) {
      this.info('表格数据为空');
      return;
    }

    const headers = Object.keys(data[0]);
    const maxLengths = headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String(row[header]).length)
      );
      return maxLength;
    });

    // 输出表头
    const headerRow = headers.map((header, i) => 
      header.padEnd(maxLengths[i])
    ).join(' | ');
    console.log(chalk.cyan.bold(headerRow));
    
    // 输出分隔线
    const separator = maxLengths.map(length => '-'.repeat(length)).join('-+-');
    console.log(chalk.gray(separator));
    
    // 输出数据行
    data.forEach(row => {
      const dataRow = headers.map((header, i) => 
        String(row[header]).padEnd(maxLengths[i])
      ).join(' | ');
      console.log(dataRow);
    });
  }
}

// 创建默认日志器实例
export const logger = new Logger();

// 创建不同上下文的日志器
export const createLogger = (context: string, config?: Partial<LoggerConfig>): Logger => {
  return new Logger(config, context);
};

// 导出便捷方法
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logDev = (message: string, ...args: any[]) => logger.dev(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logError = (message: string, ...args: any[]) => logger.error(message, ...args);
export const logErrorWithStack = (message: string, error: Error) => logger.errorWithStack(message, error);

// 默认导出
export default logger;
