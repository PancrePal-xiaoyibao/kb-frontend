import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import filesRouter from './routes/files.routes.js';

// 加载环境变量，默认读取 .env.dev，可通过 ENV_FILE 覆盖
dotenv.config({ path: process.env.ENV_FILE || '.env.dev' });

const app = express();

app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API v1
app.use('/api/v1', filesRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kb_local';

async function start() {
  try {
    const database = await initDatabase(MONGODB_URI);
    app.locals.db = database;
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
