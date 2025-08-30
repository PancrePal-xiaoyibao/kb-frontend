import path from 'node:path';
import fs from 'node:fs';
import { ObjectId } from 'mongodb';

/**
 * 文件存储服务
 * 管理文件的物理存储和路径生成
 */
export class FileStorageService {
  private uploadsDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.ensureUploadsDir();
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadsDir(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * 生成文件存储路径
   */
  generateFilePath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  /**
   * 生成文件访问URL
   */
  generateFileUrl(filename: string): string {
    return `${this.baseUrl}/files/${filename}`;
  }

  /**
   * 生成文件下载URL
   */
  generateDownloadUrl(fileId: string): string {
    return `${this.baseUrl}/api/v1/file/${fileId}/download`;
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filename: string): boolean {
    const filePath = this.generateFilePath(filename);
    return fs.existsSync(filePath);
  }

  /**
   * 获取文件信息
   */
  getFileInfo(filename: string): { exists: boolean; size: number; path: string } | null {
    const filePath = this.generateFilePath(filename);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        path: filePath
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 删除物理文件
   */
  deleteFile(filename: string): boolean {
    try {
      const filePath = this.generateFilePath(filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('删除文件失败:', error);
      return false;
    }
  }

  /**
   * 移动文件到新位置
   */
  moveFile(oldFilename: string, newFilename: string): boolean {
    try {
      const oldPath = this.generateFilePath(oldFilename);
      const newPath = this.generateFilePath(newFilename);
      
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('移动文件失败:', error);
      return false;
    }
  }

  /**
   * 获取文件流
   */
  getFileStream(filename: string): fs.ReadStream | null {
    try {
      const filePath = this.generateFilePath(filename);
      if (fs.existsSync(filePath)) {
        return fs.createReadStream(filePath);
      }
      return null;
    } catch (error) {
      console.error('获取文件流失败:', error);
      return null;
    }
  }

  /**
   * 清理过期文件
   */
  cleanupExpiredFiles(expiredFiles: Array<{ filename: string; _id: ObjectId }>): number {
    let deletedCount = 0;
    
    for (const file of expiredFiles) {
      if (this.deleteFile(file.filename)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * 获取存储统计信息
   */
  getStorageStats(): { totalFiles: number; totalSize: number; directory: string } {
    try {
      const files = fs.readdirSync(this.uploadsDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch (error) {
          // 忽略无法访问的文件
        }
      }
      
      return {
        totalFiles: files.length,
        totalSize,
        directory: this.uploadsDir
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        directory: this.uploadsDir
      };
    }
  }
}
