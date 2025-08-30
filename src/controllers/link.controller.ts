import type { Request, Response, NextFunction } from 'express';
import { container } from '../services/container.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../utils/logger.js';
import { LinkUploadService } from '../services/link-upload.service.js';

// 创建链接控制器日志器
const logger = createLogger('LinkController');

/**
 * 链接控制器
 * 处理链接相关的HTTP请求
 */
export class LinkController {
  /**
   * 创建安全的链接对象，过滤敏感信息
   */
  public static createSafeLink(link: any) {
    return {
      _id: link._id,
      shortCode: link.shortCode,
      originalName: link.originalName,
      mimeType: link.mimeType,
      size: link.size,
      filename: link.filename,
      uploaderId: link.uploaderId,
      status: link.status,
      categories: link.categories,
      tags: link.tags,
      description: link.description,
      uploadedAt: link.uploadedAt,
      updatedAt: link.updatedAt,
      isLink: link.isLink,
      linkUrl: link.linkUrl,
      linkTitle: link.linkTitle,
      linkDescription: link.linkDescription,
      linkThumbnail: link.linkThumbnail
    };
  }

  /**
   * 获取客户端IP地址
   */
  public static getClientIp(req: Request): string {
    return req.ip || 
           (req.connection as any)?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
  }

  /**
   * 统一链接上传接口
   * 支持单个和多个链接上传
   */
  static async uploadLinks(req: Request, res: Response, next: NextFunction) {
    try {
      const linkUploadService = container.getLinkUploadService();
      const { urls, categories, tags } = req.body;
      
      logger.info('收到链接上传请求', { 
        urlCount: urls?.length || 0,
        categories,
        tags,
        ip: LinkController.getClientIp(req),
        userAgent: req.get('User-Agent')
      });
      
      // 验证必要字段
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        logger.warn('链接上传失败：缺少URL列表', { ip: this.getClientIp(req) });
        return res.status(400).json({
          success: false,
          message: '请提供URL列表'
        });
      }

      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        logger.warn('链接上传失败：缺少分类', { ip: this.getClientIp(req) });
        return res.status(400).json({
          success: false,
          message: '请提供至少一个分类'
        });
      }

      // 验证每个URL的必要字段
      const invalidUrls = urls.filter(item => !item.url);
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          message: '部分URL缺少url字段'
        });
      }

      // 构建链接数据结构
      const linksData = urls.map(item => ({
        url: item.url,
        title: item.title,
        description: item.description,
        categories: item.categories || [],
        tags: item.tags || [],
        uploaderId: undefined, // 公开上传，无需用户ID
        uploadIp: LinkController.getClientIp(req)
      }));

      // 应用全局分类和标签
      const batchData = {
        links: linksData,
        categories,
        tags: tags || []
      };

      // 根据链接数量决定使用单个还是批量上传
      let result;
      if (linksData.length === 1) {
        // 单个链接上传
        const singleLink = await linkUploadService.uploadLink({
          ...linksData[0],
          categories: [...categories, ...(linksData[0].categories || [])],
          tags: [...(tags || []), ...(linksData[0].tags || [])]
        });
        
        result = {
          success: true,
          files: [singleLink],
          errors: []
        };
      } else {
        // 批量链接上传
        result = await linkUploadService.uploadLinks(batchData);
      }
      
      if (!result.success) {
        logger.warn('链接上传部分失败', { 
          totalUrls: urls.length,
          successCount: result.files.length,
          errorCount: result.errors.length
        });
      } else {
        logger.info('链接上传成功', { 
          totalUrls: urls.length,
          successCount: result.files.length
        });
      }

      // 过滤敏感信息，只返回前端需要的数据
      const safeFiles = result.files.map(file => LinkController.createSafeLink(file));

      // 如果只有一个链接，返回单链接格式
      if (safeFiles.length === 1) {
        logger.info('单链接上传成功', { 
          linkUrl: safeFiles[0].linkUrl,
          linkId: safeFiles[0]._id,
          shortCode: safeFiles[0].shortCode
        });
        
        return res.status(201).json({
          success: true,
          message: '链接上传成功',
          data: safeFiles[0]
        });
      }

      // 多链接返回格式
      res.status(201).json({
        success: result.success,
        message: result.success ? '所有链接上传成功' : '部分链接上传失败',
        data: {
          files: safeFiles,
          total: safeFiles.length,
          errors: result.errors
        }
      });
    } catch (error) {
      logger.errorWithStack('链接上传过程中发生错误', error as Error);
      next(error);
    }
  }

  /**
   * 获取链接列表
   */
  static async getLinks(req: Request, res: Response, next: NextFunction) {
    try {
      const linkUploadService = container.getLinkUploadService();
      const { page = 1, limit = 20, uploaderId } = req.query;

      logger.info('收到获取链接列表请求', { 
        uploaderId,
        page, 
        limit,
        ip: this.getClientIp(req)
      });

      // 如果没有指定uploaderId，返回所有公开链接
      if (!uploaderId) {
        const result = await linkUploadService.searchLinks('', parseInt(page as string), parseInt(limit as string));
        
        // 过滤敏感信息，只返回前端需要的数据
        const safeLinks = result.links.map(link => LinkController.createSafeLink(link));
        
        res.json({
          success: true,
          data: safeLinks,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: result.total,
            pages: Math.ceil(result.total / parseInt(limit as string))
          }
        });
        return;
      }

      // 如果指定了uploaderId，验证格式
      if (!ObjectId.isValid(uploaderId as string)) {
        return res.status(400).json({
          success: false,
          message: '无效的用户ID'
        });
      }

      const result = await linkUploadService.getUserLinks(
        new ObjectId(uploaderId as string),
        parseInt(page as string),
        parseInt(limit as string)
      );

      // 过滤敏感信息，只返回前端需要的数据
      const safeLinks = result.links.map(link => LinkController.createSafeLink(link));

      logger.info('链接列表查询成功', { 
        uploaderId,
        totalLinks: result.total,
        returnedLinks: safeLinks.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: safeLinks,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: Math.ceil(result.total / parseInt(limit as string))
        }
      });
    } catch (error) {
      logger.errorWithStack('获取链接列表时发生错误', error as Error);
      next(error);
    }
  }

  /**
   * 搜索链接
   */
  static async searchLinks(req: Request, res: Response, next: NextFunction) {
    try {
      const linkUploadService = container.getLinkUploadService();
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          message: '请提供搜索关键词'
        });
      }

      logger.info('收到链接搜索请求', { 
        query: q,
        page, 
        limit,
        ip: this.getClientIp(req)
      });

      const result = await linkUploadService.searchLinks(
        q,
        parseInt(page as string),
        parseInt(limit as string)
      );

      // 过滤敏感信息，只返回前端需要的数据
      const safeLinks = result.links.map(link => LinkController.createSafeLink(link));

      logger.info('链接搜索成功', { 
        query: q,
        totalLinks: result.total,
        returnedLinks: safeLinks.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: safeLinks,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: Math.ceil(result.total / parseInt(limit as string))
        }
      });
    } catch (error) {
      logger.errorWithStack('搜索链接时发生错误', error as Error);
      next(error);
    }
  }

  /**
   * 获取链接元数据处理状态
   */
  static async getMetadataStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { linkId } = req.params;
      
      if (!ObjectId.isValid(linkId)) {
        res.status(400).json({ error: '无效的链接ID' });
        return;
      }

      const linkUploadService = container.getLinkUploadService();
      const status = await linkUploadService.getMetadataStatus(new ObjectId(linkId));
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * 手动重试元数据提取
   */
  static async retryMetadataExtraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { linkId } = req.params;
      
      if (!ObjectId.isValid(linkId)) {
        res.status(400).json({ error: '无效的链接ID' });
        return;
      }

      const linkUploadService = container.getLinkUploadService();
      await linkUploadService.retryMetadataExtraction(new ObjectId(linkId));
      
      res.json({
        success: true,
        message: '元数据重新提取已启动'
      });
      
    } catch (error) {
      next(error);
    }
  }
}