import { Router } from 'express';
import { uploadAny } from '../middlewares/upload.js';
import { uploadFileController } from '../controllers/file.controller.js';

const router = Router();

// POST /api/v1/file/upload - 上传单/多文件
router.post('/upload', uploadAny, uploadFileController);

export default router;


