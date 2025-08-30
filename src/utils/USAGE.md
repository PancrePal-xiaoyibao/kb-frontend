# 日志工具使用说明

## 快速开始

### 1. 基本导入
```typescript
import logger from './utils/logger';
// 或者导入特定功能
import { createLogger, LogLevel } from './utils/logger';
```

### 2. 基本使用
```typescript
// 信息日志
logger.info('用户登录成功');

// 开发调试日志
logger.dev('API请求参数', { method: 'POST', url: '/api/users' });

// 警告日志
logger.warn('数据库连接缓慢', { responseTime: '2.5s' });

// 错误日志
logger.error('文件上传失败', { error: '文件过大' });

// 错误堆栈
try {
  // 可能出错的代码
} catch (error) {
  logger.errorWithStack('操作失败', error as Error);
}
```

### 3. 创建上下文日志器
```typescript
const authLogger = createLogger('Auth');
const fileLogger = createLogger('FileService');

authLogger.info('用户认证开始');
fileLogger.dev('文件上传处理中');
```

### 4. 配置选项
```typescript
const customLogger = createLogger('Custom', {
  enableTimestamp: false,    // 禁用时间戳
  enableColors: false,       // 禁用颜色
  enableSymbols: false,      // 禁用符号
  maxLevel: LogLevel.WARN    // 只显示WARN及以上级别
});
```

## 日志级别

- **INFO** (蓝色 ℹ): 一般信息
- **DEV** (青色 🔧): 开发调试信息  
- **WARN** (黄色 ⚠): 警告信息
- **ERROR** (红色 ❌): 错误信息

## 在项目中的使用

### 控制器中
```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('UserController');

export const createUser = async (req: Request, res: Response) => {
  try {
    logger.info('创建用户请求', { body: req.body });
    // 业务逻辑...
    logger.info('用户创建成功', { userId: user.id });
    res.status(201).json(user);
  } catch (error) {
    logger.errorWithStack('用户创建失败', error as Error);
    res.status(500).json({ error: '内部服务器错误' });
  }
};
```

### 服务中
```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('FileService');

export const uploadFile = async (file: Express.Multer.File) => {
  logger.dev('开始处理文件上传', { filename: file.originalname, size: file.size });
  // 文件处理逻辑...
  logger.info('文件上传完成', { fileId: result.id });
  return result;
};
```

### 中间件中
```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthMiddleware');

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.dev('验证用户身份', { path: req.path, method: req.method });
  // 验证逻辑...
  if (isValid) {
    logger.info('用户身份验证通过', { userId: req.user.id });
    next();
  } else {
    logger.warn('用户身份验证失败', { ip: req.ip });
    res.status(401).json({ error: '未授权' });
  }
};
```

## 注意事项

1. 确保已安装 `chalk` 依赖
2. 在生产环境中建议禁用颜色输出以提高性能
3. 为不同模块创建独立的日志器实例
4. 使用适当的日志级别记录信息
