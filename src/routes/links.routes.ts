import { Router } from 'express';
import { LinkController } from '../controllers/link.controller.js';

const router = Router();

// 链接上传相关路由（公开，无需鉴权）
router.post('/upload', LinkController.uploadLinks);

// 链接管理相关路由
router.get('/', LinkController.getLinks);
router.get('/search', LinkController.searchLinks);

// 获取链接元数据处理状态
router.get('/:linkId/metadata-status', LinkController.getMetadataStatus.bind(LinkController));

// 手动重试元数据提取
router.post('/:linkId/retry-metadata', LinkController.retryMetadataExtraction.bind(LinkController));

export default router;