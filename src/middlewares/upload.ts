import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 文件上传中间件
 * - 使用 Multer 的磁盘存储，将文件保存到本地 uploads 目录
 * - 如果目录不存在会自动创建
 * - 命名规则：<字段名>-<时间戳>-<随机数>.<原始扩展名>
 */
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

/**
 * 单文件上传中间件
 * - 表单字段名：file
 */
export const uploadSingle = multer({ storage }).single('file');


