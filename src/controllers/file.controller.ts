import type { Request, Response, NextFunction } from 'express';
import type { Db } from 'mongodb';
import { saveFileMetadata } from '../services/file.service.js';
import path from 'node:path';
import mime from 'mime-types';

/**
 * 处理单文件上传
 * - 依赖 multer 中间件将文件写入本地磁盘
 * - 将文件元数据（时间、名称、大小、MIME、路径、上传 IP）写入数据库的 file 集合
 */
export async function uploadFileController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const db = req.app.locals.db as Db;
    // 获取上传 IP（优先 x-forwarded-for）
    const forwarded = req.headers['x-forwarded-for'];
    const uploadIp = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.ip || '');
    // 基于文件内容自动检测 MIME 类型，优先使用检测结果
    // 动态导入 file-type（其导出在不同环境下可能变动）
    let detectedMime = '';
    try {
      const mod: any = await import('file-type');
      if (typeof mod.fileTypeFromFile === 'function') {
        const detected = await mod.fileTypeFromFile(req.file.path);
        detectedMime = detected?.mime || '';
      }
    } catch {}
    const extFallback = mime.lookup(path.extname(req.file.originalname)) || '';
    const finalMime = detectedMime || req.file.mimetype || (typeof extFallback === 'string' ? extFallback : '');

    const saved = await saveFileMetadata(db, {
      originalName: req.file.originalname,
      mimeType: finalMime,
      size: req.file.size,
      filename: req.file.filename,
      filepath: req.file.path,
      uploadedAt: new Date(),
      uploadIp,
    });

    return res.status(201).json({ data: saved });
  } catch (error) {
    next(error);
  }
}


