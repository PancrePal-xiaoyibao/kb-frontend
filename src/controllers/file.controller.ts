import type { Request, Response, NextFunction } from 'express';
import { container } from '../services/container.js';
import { ObjectId } from 'mongodb';

/**
 * 文件控制器
 * 处理文件相关的HTTP请求
 */
export class FileController {
  /**
   * 统一文件上传接口
   * 支持单文件和多文件上传
   */
  static async uploadFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const uploadService = container.getUploadService();
      const { categories } = req.body;
      
      // 检查是否有文件
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有接收到文件'
        });
      }

      const files = req.files as Express.Multer.File[];
      
      // 使用统一的文件上传处理方法
      const result = await uploadService.handleFileUpload(files, req, categories);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: '文件上传失败',
          errors: result.errors
        });
      }

      // 如果只有一个文件，返回单文件格式
      if (result.files && result.files.length === 1) {
        return res.status(201).json({
          success: true,
          message: '文件上传成功',
          data: result.files[0]
        });
      }

      // 多文件返回格式
      res.status(201).json({
        success: true,
        message: '文件上传成功',
        data: {
          files: result.files,
          total: result.files?.length || 0,
          errors: result.errors
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取文件列表
   */
  static async getFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const fileService = container.getFileService();
      const { page = 1, limit = 20, uploaderId, status, categories, tags, mimeType } = req.query;

      const query = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        uploaderId: uploaderId ? new ObjectId(uploaderId as string) : undefined,
        status: status as any,
        categories: categories ? (Array.isArray(categories) ? categories.map(c => String(c)) : [String(categories)]) : undefined,
        tags: tags ? (Array.isArray(tags) ? tags.map(t => String(t)) : [String(tags)]) : undefined,
        mimeType: mimeType as string
      };

      const result = await fileService.findFiles(query);

      res.json({
        success: true,
        data: result.files,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          pages: Math.ceil(result.total / query.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取文件详情
   */
  static async getFileById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const fileService = container.getFileService();

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: '无效的文件ID'
        });
      }

      const file = await fileService.findFileById(new ObjectId(id));
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      // 不返回敏感信息，只返回前端需要的数据
      const safeFile = {
        _id: file._id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        filename: file.filename,
        uploaderId: file.uploaderId,
        status: file.status,
        categories: file.categories,
        tags: file.tags,
        description: file.description,
        uploadedAt: file.uploadedAt,
        updatedAt: file.updatedAt
      };

      res.json({
        success: true,
        data: safeFile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 下载文件
   */
  static async downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const fileService = container.getFileService();
      const fileStorageService = container.getFileStorageService();

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: '无效的文件ID'
        });
      }

      const file = await fileService.findFileById(new ObjectId(id));
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      // 检查文件是否存在于磁盘
      if (!fileStorageService.fileExists(file.filename)) {
        return res.status(404).json({
          success: false,
          message: '文件已丢失'
        });
      }

      // 设置下载头
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.size.toString());

      // 创建文件流并发送
      const fileStream = fileStorageService.getFileStream(file.filename);
      if (fileStream) {
        fileStream.pipe(res);
      } else {
        res.status(500).json({
          success: false,
          message: '文件读取失败'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新文件信息
   */
  static async updateFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { categories, tags, description, status } = req.body;
      const fileService = container.getFileService();

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: '无效的文件ID'
        });
      }

      const updates = { categories, tags, description, status };
      const success = await fileService.updateFile(new ObjectId(id), updates);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或更新失败'
        });
      }

      res.json({
        success: true,
        message: '文件更新成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除文件（软删除）
   */
  static async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const fileService = container.getFileService();

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: '无效的文件ID'
        });
      }

      const success = await fileService.deleteFile(new ObjectId(id));
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或删除失败'
        });
      }

      res.json({
        success: true,
        message: '文件删除成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取文件统计信息
   */
  static async getFileStats(req: Request, res: Response, next: NextFunction) {
    try {
      const fileService = container.getFileService();
      const { uploaderId } = req.query;

      const stats = await fileService.getFileStats(
        uploaderId ? new ObjectId(uploaderId as string) : undefined
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取所有分类列表
   */
  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const fileService = container.getFileService();
      const categories = await fileService.getAllCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量更新文件状态
   */
  static async batchUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileIds, status } = req.body;
      const fileService = container.getFileService();

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供有效的文件ID列表'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: '请提供要更新的状态'
        });
      }

      // 验证所有ID都是有效的ObjectId
      const validIds = fileIds.filter(id => ObjectId.isValid(id));
      if (validIds.length !== fileIds.length) {
        return res.status(400).json({
          success: false,
          message: '包含无效的文件ID'
        });
      }

      const objectIds = validIds.map(id => new ObjectId(id));
      const updatedCount = await fileService.batchUpdateStatus(objectIds, status);

      res.json({
        success: true,
        message: `成功更新 ${updatedCount} 个文件的状态`,
        data: { updatedCount }
      });
    } catch (error) {
      next(error);
    }
  }
}


