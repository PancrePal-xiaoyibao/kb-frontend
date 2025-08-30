import { Request } from 'express';
import { FileService } from './file.service';
import { FileInput } from '../models/file.model';
import { ObjectId } from 'mongodb';
import path from 'node:path';

/**
 * 文件上传服务
 * 处理文件上传的业务逻辑
 */
export class UploadService {
  private fileService: FileService;
  private shortCodeService: any; // 暂时使用any，后面会通过容器注入

  constructor(fileService: FileService, shortCodeService?: any) {
    this.fileService = fileService;
    this.shortCodeService = shortCodeService;
  }

  /**
   * 处理单文件上传
   */
  async handleSingleFileUpload(req: Request, uploaderId?: ObjectId, categories?: string[]): Promise<{
    success: boolean;
    file?: any;
    error?: string;
  }> {
    try {
      if (!req.file) {
        return {
          success: false,
          error: '没有接收到文件'
        };
      }

      const file = req.file;
      const uploadIp = this.getClientIp(req);

      // 生成唯一短码
      const shortCode = this.shortCodeService ? 
        await this.shortCodeService.generateUniqueShortCode() : 
        'TEMP' + Math.random().toString(36).substr(2, 4).toUpperCase();

      // 构建文件输入数据
      const fileInput: FileInput = {
        shortCode,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.filename,
        uploaderId,
        uploadIp,
        categories: categories || [],
        tags: this.extractTagsFromFilename(file.originalname),
        description: this.generateDescription(file)
      };

      // 保存文件元数据
      const savedFile = await this.fileService.saveFileMetadata(fileInput);

      return {
        success: true,
        file: savedFile
      };
    } catch (error) {
      console.error('文件上传处理失败:', error);
      return {
        success: false,
        error: '文件上传处理失败'
      };
    }
  }

  /**
   * 统一文件上传处理
   * 支持单文件和多文件
   */
  async handleFileUpload(files: Express.Multer.File[], req: Request, categories?: string[], uploaderId?: ObjectId): Promise<{
    success: boolean;
    files?: any[];
    errors?: string[];
  }> {
    try {
      if (!files || files.length === 0) {
        return {
          success: false,
          errors: ['没有接收到文件']
        };
      }

      const uploadIp = this.getClientIp(req);
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          // 生成唯一短码
          const shortCode = this.shortCodeService ? 
            await this.shortCodeService.generateUniqueShortCode() : 
            'TEMP' + Math.random().toString(36).substr(2, 4).toUpperCase();

          const fileInput: FileInput = {
            shortCode,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            filename: file.filename,
            uploaderId,
            uploadIp,
            categories: categories || [],
            tags: this.extractTagsFromFilename(file.originalname),
            description: this.generateDescription(file)
          };

          const savedFile = await this.fileService.saveFileMetadata(fileInput);
          results.push(savedFile);
        } catch (error) {
          console.error(`文件 ${file.originalname} 上传失败:`, error);
          errors.push(`文件 ${file.originalname} 上传失败`);
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          errors
        };
      }

      return {
        success: true,
        files: results,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('文件上传处理失败:', error);
      return {
        success: false,
        errors: ['文件上传处理失败']
      };
    }
  }

  /**
   * 处理多文件上传
   */
  async handleMultipleFileUpload(req: Request, uploaderId?: ObjectId, categories?: string[]): Promise<{
    success: boolean;
    files?: any[];
    errors?: string[];
  }> {
    try {
      if (!req.files || req.files.length === 0) {
        return {
          success: false,
          errors: ['没有接收到文件']
        };
      }

      const files = req.files as Express.Multer.File[];
      const uploadIp = this.getClientIp(req);
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          // 生成唯一短码
          const shortCode = this.shortCodeService ? 
            await this.shortCodeService.generateUniqueShortCode() : 
            'TEMP' + Math.random().toString(36).substr(2, 4).toUpperCase();

          const fileInput: FileInput = {
            shortCode,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            filename: file.filename,
            uploaderId,
            uploadIp,
            categories: categories || [],
            tags: this.extractTagsFromFilename(file.originalname),
            description: this.generateDescription(file)
          };

          const savedFile = await this.fileService.saveFileMetadata(fileInput);
          results.push(savedFile);
        } catch (error) {
          console.error(`文件 ${file.originalname} 上传失败:`, error);
          errors.push(`文件 ${file.originalname} 上传失败`);
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          errors
        };
      }

      return {
        success: true,
        files: results,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('多文件上传处理失败:', error);
      return {
        success: false,
        errors: ['多文件上传处理失败']
      };
    }
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: Request): string {
    return req.ip || 
           (req.connection as any)?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
  }

  /**
   * 从文件名提取标签
   */
  private extractTagsFromFilename(filename: string): string[] {
    const tags: string[] = [];
    
    // 提取文件扩展名作为标签
    const ext = path.extname(filename).toLowerCase();
    if (ext) {
      tags.push(ext.substring(1)); // 去掉点号
    }

    // 提取文件名中的关键词作为标签，后续可以尝试使用LLM
    const nameWithoutExt = path.basename(filename, ext);
    const words = nameWithoutExt.split(/[-_\s]+/);
    
    words.forEach(word => {
      if (word.length > 2 && /^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(word)) {
        tags.push(word.toLowerCase());
      }
    });

    return tags.slice(0, 5); // 最多5个标签
  }

  /**
   * 生成文件描述
   */
  private generateDescription(file: Express.Multer.File): string {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const ext = path.extname(file.originalname).toUpperCase();
    
    return `文件大小: ${sizeInMB}MB, 类型: ${ext}, 上传时间: ${new Date().toLocaleString('zh-CN')}`;
  }

  /**
   * 验证文件类型
   */
  validateFileType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimeType);
  }

  /**
   * 验证文件大小
   */
  validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFile(filepath: string): Promise<void> {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }
}
