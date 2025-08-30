import { Db } from 'mongodb';

/**
 * 短码生成服务
 * 生成唯一的六位字符串（大写字母+数字）
 */
export class ShortCodeService {
  private db: Db;
  private collection: string = 'files';

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * 生成六位短码
   * 格式：大写字母 + 数字，如 A1B2C3
   */
  private generateShortCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let result = '';
    
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * 检查短码是否已存在
   */
  private async isShortCodeExists(shortCode: string): Promise<boolean> {
    const collection = this.db.collection(this.collection);
    const existingFile = await collection.findOne({ shortCode });
    return !!existingFile;
  }

  /**
   * 生成唯一的短码
   * 如果生成的短码已存在，会重新生成
   */
  async generateUniqueShortCode(): Promise<string> {
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 100; // 防止无限循环

    do {
      shortCode = this.generateShortCode();
      attempts++;
      
      if (attempts > maxAttempts) {
        throw new Error('无法生成唯一短码，请重试');
      }
    } while (await this.isShortCodeExists(shortCode));

    return shortCode;
  }

  /**
   * 批量生成短码
   */
  async generateMultipleShortCodes(count: number): Promise<string[]> {
    const shortCodes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const shortCode = await this.generateUniqueShortCode();
      shortCodes.push(shortCode);
    }
    
    return shortCodes;
  }

  /**
   * 验证短码格式
   */
  static validateShortCode(shortCode: string): boolean {
    const pattern = /^[A-Z0-9]{6}$/;
    return pattern.test(shortCode);
  }

  /**
   * 格式化短码（转换为大写）
   */
  static formatShortCode(shortCode: string): string {
    return shortCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}
