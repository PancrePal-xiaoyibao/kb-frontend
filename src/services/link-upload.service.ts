import type { Db, ObjectId } from 'mongodb';
import { FileModel, FileInput, LinkUploadInput, BatchLinkUploadInput, FileStatus } from '../models/file.model';
import { createLogger } from '../utils/logger.js';
import { ShortCodeService } from './shortcode.service.js';

// 创建链接上传服务日志器
const logger = createLogger('LinkUploadService');

/**
 * 链接上传服务类
 * 处理链接的上传、验证和元数据提取
 */
export class LinkUploadService {
  private db: Db;
  private collection: string = 'files';
  private shortCodeService: ShortCodeService;

  constructor(db: Db) {
    this.db = db;
    this.shortCodeService = new ShortCodeService(db);
    logger.info('链接上传服务初始化完成', { collection: this.collection });
  }

  /**
   * 验证链接URL格式
   */
  private validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 提取链接元数据（标题、描述等）
   * 这里可以实现更复杂的元数据提取逻辑
   */
  private async extractLinkMetadata(url: string): Promise<{
    title?: string;
    description?: string;
    thumbnail?: string;
  }> {
    try {
      // 这里可以集成第三方服务来提取链接元数据
      // 例如：Open Graph、Twitter Cards等
      // 目前返回基础信息
      return {
        title: undefined,
        description: undefined,
        thumbnail: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.warn('提取链接元数据失败', { url, error: errorMessage });
      return {
        title: undefined,
        description: undefined,
        thumbnail: undefined
      };
    }
  }

  /**
   * 生成链接文件名
   */
  private generateLinkFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      const timestamp = Date.now();
      return `link-${domain}-${path.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}`;
    } catch {
      return `link-${Date.now()}`;
    }
  }

  /**
   * 上传单个链接
   */
  async uploadLink(linkData: LinkUploadInput): Promise<FileModel> {
    try {
      logger.info('开始处理链接上传', { 
        url: linkData.url,
        categories: linkData.categories,
        uploadIp: linkData.uploadIp
      });

      // 验证URL格式
      if (!this.validateUrl(linkData.url)) {
        throw new Error('无效的URL格式');
      }

      // 生成短码
      const shortCode = await this.shortCodeService.generateUniqueShortCode();

      // 提取链接元数据
      const metadata = await this.extractLinkMetadata(linkData.url);

      // 生成链接文件名
      const filename = this.generateLinkFilename(linkData.url);

      // 构建文件输入数据
      const fileInput: FileInput = {
        shortCode,
        originalName: linkData.title || linkData.url,
        mimeType: 'text/url',
        size: linkData.url.length,
        filename,
        uploaderId: linkData.uploaderId,
        uploadIp: linkData.uploadIp,
        categories: linkData.categories,
        tags: linkData.tags,
        description: linkData.description,
        isLink: true,
        linkUrl: linkData.url,
        linkTitle: linkData.title || metadata.title,
        linkDescription: linkData.description || metadata.description,
        linkThumbnail: metadata.thumbnail
      };

      // 保存到数据库
      const collection = this.db.collection<FileModel>(this.collection);
      
      const doc: Omit<FileModel, '_id'> = {
        ...fileInput,
        status: FileStatus.ACTIVE,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const { insertedId } = await collection.insertOne(doc as any);
      const result = { ...doc, _id: insertedId };
      
      logger.info('链接上传成功', { 
        linkId: insertedId.toString(),
        url: linkData.url,
        shortCode
      });
      
      return result;
    } catch (error) {
      logger.errorWithStack('链接上传失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量上传链接
   */
  async uploadLinks(batchData: BatchLinkUploadInput): Promise<{
    success: boolean;
    files: FileModel[];
    errors: Array<{ url: string; error: string }>;
  }> {
    try {
      logger.info('开始批量链接上传', { 
        totalLinks: batchData.links.length,
        globalCategories: batchData.categories,
        globalTags: batchData.tags
      });

      const results: FileModel[] = [];
      const errors: Array<{ url: string; error: string }> = [];

      // 处理每个链接
      for (const linkData of batchData.links) {
        try {
          // 应用全局分类和标签
          const enrichedLinkData: LinkUploadInput = {
            ...linkData,
            categories: [...(batchData.categories || []), ...(linkData.categories || [])],
            tags: [...(batchData.tags || []), ...(linkData.tags || [])]
          };

          const file = await this.uploadLink(enrichedLinkData);
          results.push(file);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          errors.push({
            url: linkData.url,
            error: errorMessage
          });
          logger.warn('单个链接上传失败', { 
            url: linkData.url, 
            error: errorMessage 
          });
        }
      }

      const success = errors.length === 0;
      
      logger.info('批量链接上传完成', { 
        totalLinks: batchData.links.length,
        successCount: results.length,
        errorCount: errors.length
      });

      return {
        success,
        files: results,
        errors
      };
    } catch (error) {
      logger.errorWithStack('批量链接上传失败', error as Error);
      throw error;
    }
  }



  /**
   * 获取用户的所有链接
   */
  async getUserLinks(uploaderId: ObjectId, page: number = 1, limit: number = 20): Promise<{
    links: FileModel[];
    total: number;
  }> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      
      const skip = (page - 1) * limit;
      
      const [links, total] = await Promise.all([
        collection.find({ 
          uploaderId, 
          isLink: true,
          status: { $ne: FileStatus.DELETED } 
        })
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
        
        collection.countDocuments({ 
          uploaderId, 
          isLink: true,
          status: { $ne: FileStatus.DELETED } 
        })
      ]);

      return { links, total };
    } catch (error) {
      logger.errorWithStack('获取用户链接列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 搜索链接
   */
  async searchLinks(query: string, page: number = 1, limit: number = 20): Promise<{
    links: FileModel[];
    total: number;
  }> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      
      const skip = (page - 1) * limit;
      
      const filter = {
        isLink: true,
        status: { $ne: FileStatus.DELETED },
        $or: [
          { linkUrl: { $regex: query, $options: 'i' } },
          { linkTitle: { $regex: query, $options: 'i' } },
          { linkDescription: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      };

      const [links, total] = await Promise.all([
        collection.find(filter)
          .sort({ uploadedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        
        collection.countDocuments(filter)
      ]);

      return { links, total };
    } catch (error) {
      logger.errorWithStack('搜索链接失败', error as Error);
      throw error;
    }
  }
}
