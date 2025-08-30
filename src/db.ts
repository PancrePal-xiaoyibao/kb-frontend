import { MongoClient, Db } from 'mongodb';
import { createLogger } from './utils/logger.js';

// 创建数据库日志器
const logger = createLogger('Database');

let mongoClient: MongoClient | null = null;
let databaseInstance: Db | null = null;

export async function initDatabase(connectionString: string): Promise<Db> {
  if (databaseInstance && mongoClient) {
    logger.dev('数据库连接已存在，返回现有实例');
    return databaseInstance;
  }

  try {
    logger.info('正在连接MongoDB...', { connectionString: connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') });
    
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    databaseInstance = mongoClient.db();
    
    logger.info('MongoDB连接成功', { 
      database: databaseInstance.databaseName,
      collections: await databaseInstance.listCollections().toArray().then(cols => cols.map(c => c.name))
    });
    
    return databaseInstance;
  } catch (error) {
    logger.errorWithStack('MongoDB连接失败', error as Error);
    throw error;
  }
}

export function getDatabase(): Db {
  if (!databaseInstance) {
    const error = new Error('Database has not been initialized. Call initDatabase() first.');
    logger.error('尝试获取未初始化的数据库实例');
    throw error;
  }
  return databaseInstance;
}

export async function closeDatabase(): Promise<void> {
  if (mongoClient) {
    try {
      logger.info('正在关闭MongoDB连接...');
      await mongoClient.close();
      mongoClient = null;
      databaseInstance = null;
      logger.info('MongoDB连接已关闭');
    } catch (error) {
      logger.errorWithStack('关闭MongoDB连接时出错', error as Error);
    }
  }
}

