import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ServiceContainer } from '../services/container';
import { LinkUploadService } from '../services/link-upload.service';
import linksRouter from '../routes/links.routes';

describe('Links API Integration Tests', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    // 启动内存MongoDB服务器
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // 连接到内存数据库
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    
    // 设置环境变量
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    // 初始化服务容器
    const db = mongoClient.db();
    const serviceContainer = ServiceContainer.getInstance();
    
    // 手动初始化服务，避免依赖db.js
    serviceContainer['db'] = db;
    serviceContainer['linkUploadService'] = new LinkUploadService(db);
    serviceContainer['initialized'] = true;

    // 创建Express应用
    app = express();
    app.use(helmet());
    app.use(cors({ origin: '*' }));
    app.use(express.json());
    app.use(morgan('dev'));
    
    // 使用链接路由
    app.use('/api/v1/links', linksRouter);
  });

  afterAll(async () => {
    // 清理连接
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // 在每个测试前清理数据库
    if (mongoClient) {
      const db = mongoClient.db();
      const collections = await db.listCollections().toArray();
      for (const collection of collections) {
        await db.collection(collection.name).deleteMany({});
      }
    }
  });

  describe('POST /api/v1/links/upload', () => {
    it('应该成功上传单个链接', async () => {
      const linkData = {
        urls: [{
          url: 'https://example.com',
          title: 'Example Website',
          description: 'This is an example website'
        }],
        categories: ['website'],
        tags: ['example', 'test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('链接上传成功');
      expect(response.body.data).toMatchObject({
        linkUrl: 'https://example.com',
        linkTitle: 'Example Website',
        isLink: true
      });
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data).toHaveProperty('shortCode');
    });

    it('应该成功上传多个链接', async () => {
      const linkData = {
        urls: [
          {
            url: 'https://example1.com',
            title: 'Example 1',
            description: 'First example'
          },
          {
            url: 'https://example2.com',
            title: 'Example 2',
            description: 'Second example'
          }
        ],
        categories: ['website'],
        tags: ['example', 'test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('所有链接上传成功');
      expect(response.body.data.files).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.errors).toEqual([]);
    });

    it('应该在缺少URL时返回400错误', async () => {
      const linkData = {
        urls: [],
        categories: ['website'],
        tags: ['test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请提供URL列表');
    });

    it('应该在缺少分类时返回400错误', async () => {
      const linkData = {
        urls: [{ url: 'https://example.com' }],
        categories: [],
        tags: ['test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请提供至少一个分类');
    });

    it('应该在URL无效时返回400错误', async () => {
      const linkData = {
        urls: [{ url: 'invalid-url' }],
        categories: ['website'],
        tags: ['test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('无效的URL格式');
    });

    it('应该正确处理部分链接上传失败', async () => {
      const linkData = {
        urls: [
          { url: 'https://example1.com' }, // 有效的
          { url: 'invalid-url' }          // 无效的
        ],
        categories: ['website'],
        tags: ['test']
      };

      const response = await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('部分链接上传失败');
      expect(response.body.data.files).toHaveLength(1);
      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.errors[0]).toMatchObject({
        url: 'invalid-url',
        error: expect.any(String)
      });
    });
  });

  describe('GET /api/v1/links', () => {
    beforeEach(async () => {
      // 添加测试数据
      const linkData = {
        urls: [
          { url: 'https://example1.com', title: 'Example 1' },
          { url: 'https://example2.com', title: 'Example 2' }
        ],
        categories: ['website'],
        tags: ['test']
      };

      await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(201);
    });

    it('应该成功获取链接列表', async () => {
      const response = await request(app)
        .get('/api/v1/links')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        total: 2,
        page: 1,
        limit: 20
      });
    });

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/v1/links?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({
        total: 2,
        page: 1,
        limit: 1,
        pages: 2
      });
    });
  });

  describe('GET /api/v1/links/search', () => {
    beforeEach(async () => {
      // 添加测试数据
      const linkData = {
        urls: [
          { url: 'https://example.com', title: 'Example Website' },
          { url: 'https://test.com', title: 'Test Site' }
        ],
        categories: ['website'],
        tags: ['test']
      };

      await request(app)
        .post('/api/v1/links/upload')
        .send(linkData)
        .expect(201);
    });

    it('应该成功搜索链接', async () => {
      const response = await request(app)
        .get('/api/v1/links/search?q=example')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].linkTitle).toBe('Example Website');
    });

    it('应该在缺少搜索参数时返回400错误', async () => {
      const response = await request(app)
        .get('/api/v1/links/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请提供搜索关键词');
    });

    it('应该在没有搜索结果时返回空数组', async () => {
      const response = await request(app)
        .get('/api/v1/links/search?q=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理无效的JSON', async () => {
      const response = await request(app)
        .post('/api/v1/links/upload')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('应该正确处理空请求体', async () => {
      const response = await request(app)
        .post('/api/v1/links/upload')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请提供URL列表');
    });
  });
});