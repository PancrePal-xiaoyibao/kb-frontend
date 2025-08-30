import { Router } from 'express';
import { LinkController } from '../controllers/link.controller.js';

const router = Router();

// 链接上传相关路由（公开，无需鉴权）
router.post('/upload', LinkController.uploadLinks);

// 链接管理相关路由
router.get('/', LinkController.getLinks);
router.get('/search', LinkController.searchLinks);

export default router;