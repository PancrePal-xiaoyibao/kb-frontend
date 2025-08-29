import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { container } from './services/container.js';
import filesRouter from './routes/files.routes.js';
import authRouter from './routes/auth.routes.js';

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
  res.status(404).json({
    message: '->你似乎来到了接口的荒漠<-'
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kb_local';

async function start() {
  try {
    const database = await initDatabase(MONGODB_URI);
    app.locals.db = database;
    console.log('Connected to MongoDB');

    // 初始化服务容器
    await container.initialize();
    console.log('Service container initialized');

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
