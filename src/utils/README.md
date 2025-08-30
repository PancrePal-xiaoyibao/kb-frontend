# 日志工具 (Logger)

这是一个功能丰富的日志处理工具，支持多种日志级别、富文本输出、上下文管理和配置选项。

## 特性

- 🎨 **富文本输出**: 支持颜色、符号和格式化
- 📊 **多种日志级别**: INFO、DEV、WARN、ERROR
- 🏷️ **上下文管理**: 可以为不同模块创建独立的日志器
- ⚙️ **灵活配置**: 支持时间戳、颜色、符号等配置选项
- 📋 **表格输出**: 支持结构化数据的表格显示
- 🔧 **动态配置**: 运行时更新配置选项

## 安装依赖

```bash
npm install chalk
```

## 基本使用

### 导入日志工具

```typescript
import logger from './utils/logger';
// 或者导入特定功能
import { createLogger, LogLevel, logInfo, logDev, logWarn, logError } from './utils/logger';
```

### 基本日志输出

```typescript
// 信息日志
logger.info('这是一条信息日志');

// 开发调试日志
logger.dev('这是一条开发调试日志');

// 警告日志
logger.warn('这是一条警告日志');

// 错误日志
logger.error('这是一条错误日志');
```

### 便捷方法

```typescript
// 使用便捷方法
logInfo('使用便捷方法输出信息');
logDev('使用便捷方法输出调试信息');
logWarn('使用便捷方法输出警告');
logError('使用便捷方法输出错误');
```

### 带参数的日志

```typescript
// 可以传递额外的参数
logger.info('用户登录成功', { userId: 123, username: 'testuser' });
logger.dev('API请求参数', { method: 'POST', url: '/api/users' });
logger.warn('性能警告', { responseTime: '2.5s', threshold: '1s' });
logger.error('操作失败', { operation: 'fileUpload', error: '权限不足' });
```

### 错误堆栈输出

```typescript
try {
  // 一些可能出错的代码
  throw new Error('这是一个测试错误');
} catch (error) {
  logger.errorWithStack('捕获到错误', error as Error);
}
```

## 高级功能

### 创建上下文日志器

```typescript
import { createLogger } from './utils/logger';

// 为不同模块创建独立的日志器
const authLogger = createLogger('Auth');
const fileLogger = createLogger('FileService');
const dbLogger = createLogger('Database');

authLogger.info('用户认证开始');
fileLogger.dev('文件上传处理中');
dbLogger.warn('数据库连接池使用率过高');
```

### 配置选项

```typescript
import { createLogger, LogLevel } from './utils/logger';

const customLogger = createLogger('Custom', {
  enableTimestamp: false,    // 禁用时间戳
  enableColors: false,       // 禁用颜色
  enableSymbols: false,      // 禁用符号
  maxLevel: LogLevel.WARN    // 只显示WARN及以上级别的日志
});
```

### 子日志器

```typescript
const mainLogger = createLogger('Main');
const subLogger = mainLogger.child('SubModule');

mainLogger.info('主模块启动');
subLogger.dev('子模块初始化');
```

### 动态配置更新

```typescript
const dynamicLogger = createLogger('Dynamic');
dynamicLogger.info('初始配置下的日志');

// 运行时更新配置
dynamicLogger.updateConfig({ enableColors: false });
dynamicLogger.info('更新配置后的日志');

// 恢复配置
dynamicLogger.updateConfig({ enableColors: true });
dynamicLogger.info('恢复配置后的日志');
```

### 特殊输出

```typescript
// 分隔线
logger.separator();
logger.separator('*', 30); // 自定义字符和长度

// 表格输出
logger.table([
  { id: 1, name: '张三', role: 'admin' },
  { id: 2, name: '李四', role: 'user' }
]);
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableTimestamp` | boolean | true | 是否显示时间戳 |
| `enableColors` | boolean | true | 是否启用颜色 |
| `enableSymbols` | boolean | true | 是否显示符号 |
| `maxLevel` | LogLevel | ERROR | 最大日志级别 |

## 日志级别

| 级别 | 优先级 | 颜色 | 符号 | 说明 |
|------|--------|------|------|------|
| INFO | 1 | 蓝色 | ℹ | 一般信息 |
| DEV | 2 | 青色 | 🔧 | 开发调试信息 |
| WARN | 3 | 黄色 | ⚠ | 警告信息 |
| ERROR | 4 | 红色 | ❌ | 错误信息 |

## 在项目中的使用建议

### 1. 在控制器中使用

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

### 2. 在服务中使用

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('FileService');

export const uploadFile = async (file: Express.Multer.File) => {
  logger.dev('开始处理文件上传', { 
    filename: file.originalname, 
    size: file.size 
  });
  
  // 文件处理逻辑...
  
  logger.info('文件上传完成', { fileId: result.id });
  return result;
};
```

### 3. 在中间件中使用

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthMiddleware');

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.dev('验证用户身份', { 
    path: req.path, 
    method: req.method 
  });
  
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

## 运行示例

```bash
# 编译TypeScript
npm run build

# 运行示例
node dist/utils/logger.example.js
```

## 注意事项

1. 确保已安装 `chalk` 依赖
2. 在生产环境中，建议禁用颜色输出以提高性能
3. 可以根据环境变量动态调整日志级别
4. 建议为不同的业务模块创建独立的日志器实例
