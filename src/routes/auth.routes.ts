import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { container } from '../services/container.js';

const router = Router();

// 获取认证控制器
function getAuthController() {
  return new AuthController(container.getAuthService());
}

// 公开路由
router.post('/register', (req, res) => getAuthController().register(req, res));
router.post('/login', (req, res) => getAuthController().login(req, res));

// 需要认证的路由
router.get('/profile', authenticateToken, (req, res) => getAuthController().getProfile(req, res));

export default router;