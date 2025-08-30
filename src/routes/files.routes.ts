import { Router } from 'express';
import { 
  uploadSingle, 
  uploadMultiple, 
  uploadErrorHandler 
} from '../middlewares/upload.middleware.js';
import { FileController } from '../controllers/file.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// 文件上传相关路由
router.post('/upload', uploadMultiple.array('file', 5), FileController.uploadFiles);

// 文件管理相关路由
router.get('/', FileController.getFiles);
router.get('/stats', FileController.getFileStats);
router.get('/categories', FileController.getCategories);
router.get('/shortcode/:shortCode', FileController.getFileByShortCode);
router.get('/:id', FileController.getFileById);
router.get('/:id/download', FileController.downloadFile);
router.put('/:id', FileController.updateFile);
router.delete('/:id', FileController.deleteFile);
router.post('/batch/status', FileController.batchUpdateStatus);

// 错误处理中间件
router.use(uploadErrorHandler);

export default router;


