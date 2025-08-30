import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { container } from './services/container.js';
import filesRouter from './routes/files.routes.js';
import authRouter from './routes/auth.routes.js';
import { createLogger } from './utils/logger.js';

// 创建主应用日志器
const logger = createLogger('App');

// 加载环境变量，默认读取 .env.dev，可通过 ENV_FILE 覆盖
dotenv.config({ path: process.env.ENV_FILE || '.env.dev' });

const app = express();

app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));

// API v1
app.use('/api/v1/file', filesRouter);
app.use('/api/v1/auth', authRouter);

// 全局404处理 - 捕获所有未匹配的路由
app.use('*', (_req, res) => {
  logger.warn('访问了不存在的路由', { path: _req.path, method: _req.method });
  res.status(404).json({
    message: '->你似乎来到了接口的荒漠<-'
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kb_local';

async function start() {
  try {
    logger.info('正在启动应用服务器...', { port: PORT, mongodb: MONGODB_URI });
    
    const database = await initDatabase(MONGODB_URI);
    app.locals.db = database;
    logger.info('MongoDB连接成功');

    // 初始化服务容器
    await container.initialize();
    logger.info('服务容器初始化成功');

    app.listen(PORT, () => {
      logger.info('服务器启动成功', { 
        port: PORT, 
        url: `http://localhost:${PORT}`,
        environment: process.env.NODE_ENV || 'development'
      });
    });
  } catch (error) {
    logger.errorWithStack('服务器启动失败', error as Error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在优雅关闭...');
  process.exit(0);
});

start();
