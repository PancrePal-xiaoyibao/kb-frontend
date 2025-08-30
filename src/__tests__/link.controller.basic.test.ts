import { LinkController } from '../controllers/link.controller';
import { ObjectId } from 'mongodb';

describe('LinkController Basic Tests', () => {
  describe('createSafeLink', () => {
    it('应该正确过滤敏感信息', () => {
      const link = {
        _id: new ObjectId(),
        shortCode: 'ABC123',
        originalName: 'test',
        mimeType: 'text/url',
        size: 100,
        filename: 'test-file',
        uploaderId: new ObjectId(),
        status: 'active',
        categories: ['test'],
        tags: ['test'],
        description: 'test description',
        uploadedAt: new Date(),
        updatedAt: new Date(),
        isLink: true,
        linkUrl: 'https://example.com',
        linkTitle: 'Example',
        linkDescription: 'Example description',
        linkThumbnail: 'https://example.com/thumb.jpg',
        sensitiveInfo: 'should be filtered',
      };

      const safeLink = LinkController.createSafeLink(link);

      expect(safeLink).toEqual(expect.objectContaining({
        _id: link._id,
        shortCode: link.shortCode,
        linkUrl: link.linkUrl,
        linkTitle: link.linkTitle,
      }));

      expect(safeLink).not.toHaveProperty('sensitiveInfo');
    });
  });

  describe('getClientIp', () => {
    it('应该从req.ip获取IP地址', () => {
      const req = {
        ip: '192.168.1.1',
      } as any;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该从connection.remoteAddress获取IP地址', () => {
      const req = {
        ip: undefined,
        connection: { remoteAddress: '192.168.1.1' },
      } as any;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该从socket.remoteAddress获取IP地址', () => {
      const req = {
        ip: undefined,
        connection: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该在无法获取IP时返回unknown', () => {
      const req = {} as any;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('unknown');
    });
  });

  describe('uploadLinks 验证逻辑', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockNext: any;

    beforeEach(() => {
      mockRequest = {
        body: {},
        ip: '127.0.0.1',
        get: jest.fn(),
      };

      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockNext = jest.fn();
    });

    it('应该在缺少URL时返回错误', async () => {
      mockRequest.body = {
        urls: [],
        categories: ['test'],
        tags: ['test'],
      };

      await LinkController.uploadLinks(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供URL列表',
      });
    });

    it('应该在缺少分类时返回错误', async () => {
      mockRequest.body = {
        urls: [{ url: 'https://example.com' }],
        categories: [],
        tags: ['test'],
      };

      await LinkController.uploadLinks(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供至少一个分类',
      });
    });

    it('应该在URL缺少url字段时返回错误', async () => {
      mockRequest.body = {
        urls: [{ title: 'Example' }], // 缺少url字段
        categories: ['test'],
        tags: ['test'],
      };

      await LinkController.uploadLinks(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '部分URL缺少url字段',
      });
    });
  });
});