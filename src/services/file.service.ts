import type { Db, ObjectId } from 'mongodb';
import { FileModel, FileInput, FileQuery, FileUpdate, FileStatus } from '../models/file.model';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../utils/logger.js';

// 创建文件服务日志器
const logger = createLogger('FileService');

/**
 * 文件服务类
 * 处理文件的上传、查询、更新和删除等操作
 */
export class FileService {
  private db: Db;
  private collection: string = 'files';

  constructor(db: Db) {
    this.db = db;
    logger.info('文件服务初始化完成', { collection: this.collection });
  }

  /**
   * 保存文件元数据到数据库
   */
  async saveFileMetadata(fileData: FileInput): Promise<FileModel> {
    try {
      logger.dev('保存文件元数据到数据库', { 
        fileName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        uploaderId: fileData.uploaderId
      });

      const collection = this.db.collection<FileModel>(this.collection);
      
      const doc: Omit<FileModel, '_id'> = {
        ...fileData,
        status: FileStatus.ACTIVE,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const { insertedId } = await collection.insertOne(doc as any);
      const result = { ...doc, _id: insertedId };
      
      logger.info('文件元数据保存成功', { 
        fileId: insertedId.toString(),
        fileName: fileData.originalName
      });
      
      return result;
    } catch (error) {
      logger.errorWithStack('保存文件元数据失败', error as Error);
      throw error;
    }
  }

  /**
   * 根据ID查找文件
   */
  async findFileById(fileId: ObjectId): Promise<FileModel | null> {
    const collection = this.db.collection<FileModel>(this.collection);
    return await collection.findOne({ _id: fileId, status: { $ne: FileStatus.DELETED } });
  }

  /**
   * 根据短码查找文件
   */
  async findFileByShortCode(shortCode: string): Promise<FileModel | null> {
    const collection = this.db.collection<FileModel>(this.collection);
    return await collection.findOne({ shortCode, status: { $ne: FileStatus.DELETED } });
  }

  /**
   * 根据上传者ID查找文件
   */
  async findFilesByUploader(uploaderId: ObjectId, page: number = 1, limit: number = 20): Promise<{ files: FileModel[], total: number }> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const skip = (page - 1) * limit;
    
    const [files, total] = await Promise.all([
      collection.find({ 
        uploaderId, 
        status: { $ne: FileStatus.DELETED } 
      })
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
      
      collection.countDocuments({ 
        uploaderId, 
        status: { $ne: FileStatus.DELETED } 
      })
    ]);

    return { files, total };
  }

  /**
   * 根据查询条件查找文件
   */
  async findFiles(query: FileQuery): Promise<{ files: FileModel[], total: number }> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const filter: any = { status: { $ne: FileStatus.DELETED } };
    
    if (query.uploaderId) filter.uploaderId = query.uploaderId;
    if (query.status) filter.status = query.status;
    if (query.categories && query.categories.length > 0) filter.categories = { $in: query.categories };
    if (query.tags && query.tags.length > 0) filter.tags = { $in: query.tags };
    if (query.mimeType) filter.mimeType = query.mimeType;
    if (query.startDate || query.endDate) {
      filter.uploadedAt = {};
      if (query.startDate) filter.uploadedAt.$gte = query.startDate;
      if (query.endDate) filter.uploadedAt.$lte = query.endDate;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      collection.find(filter)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      
      collection.countDocuments(filter)
    ]);

    return { files, total };
  }

  /**
   * 更新文件信息
   */
  async updateFile(fileId: ObjectId, updates: FileUpdate): Promise<boolean> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const result = await collection.updateOne(
      { _id: fileId, status: { $ne: FileStatus.DELETED } },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * 删除文件（软删除）
   */
  async deleteFile(fileId: ObjectId): Promise<boolean> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const result = await collection.updateOne(
      { _id: fileId },
      { 
        $set: { 
          status: FileStatus.DELETED, 
          updatedAt: new Date() 
        } 
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * 硬删除文件（从磁盘和数据库完全删除）
   */
  async hardDeleteFile(fileId: ObjectId): Promise<boolean> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    // 先查找文件信息
    const file = await this.findFileById(fileId);
    if (!file) return false;

    // 删除磁盘上的文件
    try {
      const fileStorageService = new (await import('./file-storage.service.js')).FileStorageService();
      if (fileStorageService.fileExists(file.filename)) {
        fileStorageService.deleteFile(file.filename);
      }
    } catch (error) {
      console.error('删除磁盘文件失败:', error);
    }

    // 从数据库删除记录
    const result = await collection.deleteOne({ _id: fileId });
    return result.deletedCount > 0;
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(uploaderId?: ObjectId): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const filter: any = { status: { $ne: FileStatus.DELETED } };
    if (uploaderId) filter.uploaderId = uploaderId;

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          fileTypes: { $push: '$mimeType' }
        }
      }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    
    if (result.length === 0) {
      return { totalFiles: 0, totalSize: 0, fileTypes: {} };
    }

    const fileTypes: Record<string, number> = {};
    result[0].fileTypes.forEach((type: string) => {
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });

    return {
      totalFiles: result[0].totalFiles,
      totalSize: result[0].totalSize,
      fileTypes
    };
  }

  /**
   * 批量更新文件状态
   */
  async batchUpdateStatus(fileIds: ObjectId[], status: FileStatus): Promise<number> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const result = await collection.updateMany(
      { _id: { $in: fileIds } },
      { 
        $set: { 
          status, 
          updatedAt: new Date() 
        } 
      }
    );

    return result.modifiedCount;
  }

  /**
   * 获取所有分类列表
   */
  async getAllCategories(): Promise<string[]> {
    const collection = this.db.collection<FileModel>(this.collection);
    
    const pipeline = [
      { $match: { status: { $ne: FileStatus.DELETED } } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories' } },
      { $sort: { _id: 1 } }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    return result.map(item => item._id);
  }
}


