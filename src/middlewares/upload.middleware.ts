import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';

// 创建上传中间件日志器
const logger = createLogger('UploadMiddleware');

/**
 * 文件上传配置
 */
export interface UploadConfig {
  maxFileSize: number;        // 最大文件大小（字节）
  allowedMimeTypes: string[]; // 允许的MIME类型
  maxFiles: number;           // 最大文件数量
}

/**
 * 默认上传配置
 */
export const defaultUploadConfig: UploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFiles: 5
};

/**
 * 文件过滤器
 */
const fileFilter = (config: UploadConfig) => (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 检查文件大小
  if (file.size && file.size > config.maxFileSize) {
    logger.warn('文件上传被拒绝：文件大小超过限制', { 
      fileName: file.originalname,
      fileSize: file.size,
      maxSize: config.maxFileSize,
      ip: req.ip
    });
    return cb(new Error(`文件大小超过限制: ${config.maxFileSize / (1024 * 1024)}MB`));
  }

  // 检查MIME类型
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    logger.warn('文件上传被拒绝：不支持的文件类型', { 
      fileName: file.originalname,
      mimeType: file.mimetype,
      allowedTypes: config.allowedMimeTypes,
      ip: req.ip
    });
    return cb(new Error(`不支持的文件类型: ${file.mimetype}`));
  }

  logger.dev('文件验证通过', { 
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size
  });
  cb(null, true);
};

/**
 * 确保上传目录存在
 */
const ensureUploadsDir = () => {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    logger.info('创建上传目录', { uploadsDir });
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

/**
 * 创建存储配置
 */
const createStorage = (uploadsDir: string) => {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
      logger.dev('生成唯一文件名', { 
        originalName: file.originalname,
        generatedName: filename
      });
      cb(null, filename);
    },
  });
};

/**
 * 创建上传中间件
 */
export const createUploadMiddleware = (config: Partial<UploadConfig> = {}) => {
  const finalConfig = { ...defaultUploadConfig, ...config };
  const uploadsDir = ensureUploadsDir();
  const storage = createStorage(uploadsDir);

  logger.info('创建上传中间件', { 
    maxFileSize: finalConfig.maxFileSize,
    maxFiles: finalConfig.maxFiles,
    allowedMimeTypes: finalConfig.allowedMimeTypes,
    uploadsDir
  });

  return multer({
    storage,
    fileFilter: fileFilter(finalConfig),
    limits: {
      fileSize: finalConfig.maxFileSize,
      files: finalConfig.maxFiles
    }
  });
};

/**
 * 单文件上传中间件
 */
export const uploadSingle = createUploadMiddleware({ maxFiles: 1 });

/**
 * 多文件上传中间件
 */
export const uploadMultiple = createUploadMiddleware({ maxFiles: 5 });

/**
 * 任意文件上传中间件
 */
export const uploadAny = createUploadMiddleware();

/**
 * 错误处理中间件
 */
export const uploadErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: '文件数量超过限制'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: '意外的文件字段'
      });
    }
  }

  if (err.message && err.message.includes('不支持的文件类型')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next(err);
};
