import type { Request, Response, NextFunction } from 'express';
import type { Db } from 'mongodb';
import { saveFileMetadata } from '../services/file.service.js';
import path from 'node:path';
import mime from 'mime-types';

/**
 * 处理单/多文件上传
 * - 依赖 multer 中间件将文件写入本地磁盘
 * - 将文件元数据（时间、名称、大小、MIME、路径、上传 IP）写入数据库的 file 集合
 * - 当多文件时返回数组；当单文件时也返回仅含一个元素的数组
 */
export async function uploadFileController(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (Array.isArray((req as any).files) ? (req as any).files : []) as Express.Multer.File[];
    const targetFiles: Express.Multer.File[] = files.length > 0 ? files : (req.file ? [req.file] : []);
    if (targetFiles.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const db = req.app.locals.db as Db;
    // 获取上传 IP（优先 x-forwarded-for）
    const forwarded = req.headers['x-forwarded-for'];
    const uploadIp = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.ip || '');
    // 基于文件内容自动检测 MIME 类型，优先使用检测结果
    // 逐个文件检测 MIME 并入库
    const mod: any = await import('file-type').catch(() => ({}));
    const results = [] as Array<{
      originalName: string;
      mimeType: string;
      size: number;
      filename: string;
      uploadedAt: Date;
    }>;

    for (const f of targetFiles) {
      let detectedMime = '';
      try {
        if (typeof mod.fileTypeFromFile === 'function') {
          const detected = await mod.fileTypeFromFile(f.path);
          detectedMime = detected?.mime || '';
        }
      } catch {}
      const extFallback = mime.lookup(path.extname(f.originalname)) || '';
      const finalMime = detectedMime || f.mimetype || (typeof extFallback === 'string' ? extFallback : '');

      await saveFileMetadata(db, {
        originalName: f.originalname,
        mimeType: finalMime,
        size: f.size,
        filename: f.filename,
        filepath: f.path,
        uploadedAt: new Date(),
        uploadIp,
      });

      results.push({
        originalName: f.originalname,
        mimeType: finalMime,
        size: f.size,
        filename: f.filename,
        uploadedAt: new Date(),
      });
    }

    return res.status(201).json({ data: results });
  } catch (error) {
    next(error);
  }
}


