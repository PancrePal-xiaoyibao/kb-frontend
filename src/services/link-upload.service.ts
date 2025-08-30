import type { Db, ObjectId } from 'mongodb';
import { FileModel, FileInput, LinkUploadInput, BatchLinkUploadInput, FileStatus, MetadataStatus } from '../models/file.model';
import { createLogger } from '../utils/logger';
import { ShortCodeService } from './shortcode.service';

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
   * 通过调用第三方Open Graph接口来提取元数据
   */
  private async extractLinkMetadata(url: string): Promise<{
    title?: string;
    description?: string;
    thumbnail?: string;
  }> {
    try {
      // 从环境变量获取Open Graph服务配置，支持多个备用服务
      const ogServices = [
        process.env.OG_SERVICE_URL ||
        'https://api.microlink.io?url=',
        'https://opengraph.xyz/api/v1/site-info?url='
      ].filter(Boolean);
      
      let metadata = null;
      let lastError = null;
      
      // 尝试多个服务，直到成功
      for (const serviceUrl of ogServices) {
        try {
          metadata = await this.fetchMetadataFromService(serviceUrl, url);
          if (metadata && (metadata.title || metadata.description || metadata.thumbnail)) {
            logger.info('链接元数据提取成功', { 
              url, 
              serviceUrl,
              title: metadata.title,
              description: metadata.description,
              hasThumbnail: !!metadata.thumbnail
            });
            return metadata;
          }
        } catch (error) {
          lastError = error;
          logger.warn('Open Graph服务调用失败', { 
            url, 
            serviceUrl, 
            error: error instanceof Error ? error.message : '未知错误' 
          });
          continue;
        }
      }
      
      // 如果所有服务都失败，记录错误并返回默认值
      if (lastError) {
        throw lastError;
      }
      
      return {
        title: undefined,
        description: undefined,
        thumbnail: undefined
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.warn('提取链接元数据失败', { url, error: errorMessage });
      
      // 返回默认值，不阻塞上传流程
      return {
        title: undefined,
        description: undefined,
        thumbnail: undefined
      };
    }
  }

  /**
   * 从指定的Open Graph服务获取元数据
   */
  private async fetchMetadataFromService(serviceUrl: string, targetUrl: string): Promise<{
    title?: string;
    description?: string;
    thumbnail?: string;
  }> {
    const encodedUrl = encodeURIComponent(targetUrl);
    const fullUrl = `${serviceUrl}${encodedUrl}`;
    
    logger.info('调用Open Graph服务', { url: targetUrl, serviceUrl: fullUrl });
    
    // 设置请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkMetadataExtractor/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 根据服务类型处理不同的响应格式
      if (serviceUrl.includes('microlink.io')) {
        // Microlink API返回JSON格式
        const data = await response.json();
        return {
          title: data.data?.title,
          description: data.data?.description,
          thumbnail: data.data?.image?.url
        };
      } else if (serviceUrl.includes('opengraph.xyz')) {
        // OpenGraph.xyz API返回JSON格式
        const data = await response.json();
        return {
          title: data.title,
          description: data.description,
          thumbnail: data.image
        };
      } else {
        // 默认处理HTML格式
        const html = await response.text();
        return this.parseOpenGraphMetadata(html, targetUrl);
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 解析HTML内容以提取Open Graph元数据
   */
  private parseOpenGraphMetadata(html: string, originalUrl: string): {
    title?: string;
    description?: string;
    thumbnail?: string;
  } {
    try {
      const metadata = {
        title: undefined as string | undefined,
        description: undefined as string | undefined,
        thumbnail: undefined as string | undefined
      };

      // 提取Open Graph标题
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      if (ogTitleMatch) {
        metadata.title = ogTitleMatch[1].trim();
      }

      // 提取Open Graph描述
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (ogDescMatch) {
        metadata.description = ogDescMatch[1].trim();
      }

      // 提取Open Graph图片
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (ogImageMatch) {
        metadata.thumbnail = ogImageMatch[1].trim();
      }

      // 如果没有找到Open Graph数据，尝试提取普通HTML标签
      if (!metadata.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          metadata.title = titleMatch[1].trim();
        }
      }

      if (!metadata.description) {
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        if (descMatch) {
          metadata.description = descMatch[1].trim();
        }
      }

      // 处理相对URL，转换为绝对URL
      if (metadata.thumbnail && !metadata.thumbnail.startsWith('http')) {
        try {
          const baseUrl = new URL(originalUrl);
          metadata.thumbnail = new URL(metadata.thumbnail, baseUrl.origin).href;
        } catch (e) {
          // 如果URL解析失败，保持原值
        }
      }

      return metadata;
      
    } catch (error) {
      logger.warn('解析Open Graph元数据失败', { error: error instanceof Error ? error.message : '未知错误' });
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
   * 上传单个链接（异步元数据提取）
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

      // 生成链接文件名
      const filename = this.generateLinkFilename(linkData.url);

      // 构建文件输入数据（先不提取元数据）
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
        linkTitle: linkData.title || undefined,
        linkDescription: linkData.description || undefined,
        linkThumbnail: undefined,
        metadataStatus: MetadataStatus.PENDING // 新增：元数据处理状态
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
      
      logger.info('链接上传成功，开始异步提取元数据', { 
        linkId: insertedId.toString(),
        url: linkData.url,
        shortCode
      });
      
      // 异步提取元数据（不阻塞响应）
      this.extractMetadataAsync(insertedId, linkData.url).catch(error => {
        logger.error('异步元数据提取失败', { 
          linkId: insertedId.toString(), 
          url: linkData.url, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
      });
      
      return result;
    } catch (error) {
      logger.errorWithStack('链接上传失败', error as Error);
      throw error;
    }
  }

  /**
   * 异步提取链接元数据（不阻塞主流程）
   */
  private async extractMetadataAsync(linkId: ObjectId, url: string): Promise<void> {
    try {
      logger.info('开始异步提取链接元数据', { linkId: linkId.toString(), url });
      
      // 更新状态为处理中
      await this.updateMetadataStatus(linkId, MetadataStatus.PROCESSING);
      
      // 提取元数据
      const metadata = await this.extractLinkMetadata(url);
      
      // 更新数据库中的元数据
      await this.updateLinkMetadata(linkId, metadata);
      
      // 更新状态为完成
      await this.updateMetadataStatus(linkId, MetadataStatus.COMPLETED);
      
      logger.info('异步元数据提取完成', { 
        linkId: linkId.toString(), 
        url,
        title: metadata.title,
        description: metadata.description,
        hasThumbnail: !!metadata.thumbnail
      });
      
    } catch (error) {
      logger.error('异步元数据提取失败', { 
        linkId: linkId.toString(), 
        url, 
        error: error instanceof Error ? error.message : '未知错误' 
      });
      
      // 更新状态为失败
      await this.updateMetadataStatus(linkId, MetadataStatus.FAILED);
    }
  }

  /**
   * 更新元数据处理状态
   */
  private async updateMetadataStatus(linkId: ObjectId, status: MetadataStatus): Promise<void> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      await collection.updateOne(
        { _id: linkId },
        { 
          $set: { 
            metadataStatus: status,
            updatedAt: new Date()
          } 
        }
      );
      
      logger.info('元数据状态更新', { linkId: linkId.toString(), status });
    } catch (error) {
      logger.error('更新元数据状态失败', { 
        linkId: linkId.toString(), 
        status, 
        error: error instanceof Error ? error.message : '未知错误' 
      });
    }
  }

  /**
   * 更新链接元数据
   */
  private async updateLinkMetadata(linkId: ObjectId, metadata: {
    title?: string;
    description?: string;
    thumbnail?: string;
  }): Promise<void> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      
      const updateData: any = {
        updatedAt: new Date()
      };
      
      // 只有在没有用户提供的数据时才使用提取的元数据
      if (metadata.title) {
        updateData.linkTitle = metadata.title;
      }
      if (metadata.description) {
        updateData.linkDescription = metadata.description;
      }
      if (metadata.thumbnail) {
        updateData.linkThumbnail = metadata.thumbnail;
      }
      
      await collection.updateOne(
        { _id: linkId },
        { $set: updateData }
      );
      
      logger.info('链接元数据更新成功', { 
        linkId: linkId.toString(),
        title: metadata.title,
        description: metadata.description,
        hasThumbnail: !!metadata.thumbnail
      });
    } catch (error) {
      logger.error('更新链接元数据失败', { 
        linkId: linkId.toString(), 
        error: error instanceof Error ? error.message : '未知错误' 
      });
      throw error;
    }
  }

  /**
   * 获取链接元数据处理状态
   */
  async getMetadataStatus(linkId: ObjectId): Promise<{
    status: MetadataStatus;
    metadata?: {
      title?: string;
      description?: string;
      thumbnail?: string;
    };
  }> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      const link = await collection.findOne(
        { _id: linkId, isLink: true },
        { projection: { metadataStatus: 1, linkTitle: 1, linkDescription: 1, linkThumbnail: 1 } }
      );
      
      if (!link) {
        throw new Error('链接不存在');
      }
      
      const result: {
        status: MetadataStatus;
        metadata?: {
          title?: string;
          description?: string;
          thumbnail?: string;
        };
      } = {
        status: link.metadataStatus || MetadataStatus.PENDING
      };
      
      // 如果状态是完成，返回元数据
      if (result.status === MetadataStatus.COMPLETED) {
        result.metadata = {
          title: link.linkTitle,
          description: link.linkDescription,
          thumbnail: link.linkThumbnail
        };
      }
      
      return result;
    } catch (error) {
      logger.error('获取元数据状态失败', { 
        linkId: linkId.toString(), 
        error: error instanceof Error ? error.message : '未知错误' 
      });
      throw error;
    }
  }

  /**
   * 手动触发元数据重新提取
   */
  async retryMetadataExtraction(linkId: ObjectId): Promise<void> {
    try {
      const collection = this.db.collection<FileModel>(this.collection);
      const link = await collection.findOne(
        { _id: linkId, isLink: true },
        { projection: { linkUrl: 1 } }
      );
      
      if (!link || !link.linkUrl) {
        throw new Error('链接不存在或URL无效');
      }
      
      logger.info('手动触发元数据重新提取', { linkId: linkId.toString(), url: link.linkUrl });
      
      // 异步重新提取元数据
      this.extractMetadataAsync(linkId, link.linkUrl).catch(error => {
        logger.error('手动元数据提取失败', { 
          linkId: linkId.toString(), 
          url: link.linkUrl, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
      });
      
    } catch (error) {
      logger.error('手动触发元数据提取失败', { 
        linkId: linkId.toString(), 
        error: error instanceof Error ? error.message : '未知错误' 
      });
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
