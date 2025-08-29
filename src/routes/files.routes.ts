import { Router } from 'express';
import { uploadSingle } from '../middlewares/upload.js';
import { uploadFileController } from '../controllers/file.controller.js';

const router = Router();

// POST /api/v1/files - 上传单文件
router.post('/file/upload', uploadSingle, uploadFileController);

export default router;


