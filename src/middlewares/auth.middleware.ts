import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger.js';

// 创建认证中间件日志器
const logger = createLogger('AuthMiddleware');

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('访问受保护资源失败：缺少访问令牌', { 
      path: req.path, 
      method: req.method, 
      ip: req.ip 
    });
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded: any) => {
    if (err) {
      logger.warn('访问受保护资源失败：令牌无效或已过期', { 
        path: req.path, 
        method: req.method, 
        ip: req.ip,
        error: err.message
      });
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = decoded;
    logger.dev('用户认证成功', { 
      userId: decoded.id, 
      username: decoded.username, 
      role: decoded.role,
      path: req.path,
      method: req.method
    });
    next();
  });
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    logger.warn('访问管理员资源失败：用户未认证', { 
      path: req.path, 
      method: req.method, 
      ip: req.ip 
    });
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    logger.warn('访问管理员资源失败：权限不足', { 
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      path: req.path, 
      method: req.method, 
      ip: req.ip 
    });
    return res.status(403).json({ message: 'Admin access required' });
  }

  logger.dev('管理员权限验证通过', { 
    userId: req.user.id, 
    username: req.user.username, 
    role: req.user.role,
    path: req.path,
    method: req.method
  });
  next();
};