import { Request, Response, NextFunction } from 'express';
import { LinkController } from '../controllers/link.controller';
import { container } from '../services/container';
import { ObjectId } from 'mongodb';

// Mock services
jest.mock('../services/container', () => ({
  container: {
    getLinkUploadService: jest.fn(),
  },
}));

describe('LinkController', () => {
  let mockLinkUploadService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockLinkUploadService = {
      uploadLink: jest.fn(),
      uploadLinks: jest.fn(),
      getUserLinks: jest.fn(),
      searchLinks: jest.fn(),
    };

    (container.getLinkUploadService as jest.Mock).mockReturnValue(mockLinkUploadService);

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

  describe('uploadLinks', () => {
    it('应该成功上传单个链接', async () => {
      const linkData = {
        _id: new ObjectId(),
        shortCode: 'ABC123',
        linkUrl: 'https://example.com',
        linkTitle: 'Example',
      };

      mockRequest.body = {
        urls: [{ url: 'https://example.com', title: 'Example' }],
        categories: ['test'],
        tags: ['test'],
      };

      mockLinkUploadService.uploadLink.mockResolvedValue(linkData);

      await LinkController.uploadLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '链接上传成功',
        data: expect.objectContaining({
          _id: linkData._id,
          linkUrl: 'https://example.com',
        }),
      });
    });

    it('应该成功上传多个链接', async () => {
      const linkData = [
        {
          _id: new ObjectId(),
          shortCode: 'ABC123',
          linkUrl: 'https://example1.com',
          linkTitle: 'Example 1',
        },
        {
          _id: new ObjectId(),
          shortCode: 'DEF456',
          linkUrl: 'https://example2.com',
          linkTitle: 'Example 2',
        },
      ];

      mockRequest.body = {
        urls: [
          { url: 'https://example1.com', title: 'Example 1' },
          { url: 'https://example2.com', title: 'Example 2' },
        ],
        categories: ['test'],
        tags: ['test'],
      };

      mockLinkUploadService.uploadLinks.mockResolvedValue({
        success: true,
        files: linkData,
        errors: [],
      });

      await LinkController.uploadLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '所有链接上传成功',
        data: {
          files: expect.arrayContaining([
            expect.objectContaining({ linkUrl: 'https://example1.com' }),
            expect.objectContaining({ linkUrl: 'https://example2.com' }),
          ]),
          total: 2,
          errors: [],
        },
      });
    });

    it('应该在缺少URL时返回错误', async () => {
      mockRequest.body = {
        urls: [],
        categories: ['test'],
        tags: ['test'],
      };

      await LinkController.uploadLinks(
        mockRequest as Request,
        mockResponse as Response,
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
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供至少一个分类',
      });
    });

    it('应该在部分链接上传失败时返回部分成功', async () => {
      const successfulLink = {
        _id: new ObjectId(),
        shortCode: 'ABC123',
        linkUrl: 'https://example1.com',
        linkTitle: 'Example 1',
      };

      mockRequest.body = {
        urls: [
          { url: 'https://example1.com', title: 'Example 1' },
          { url: 'https://example2.com', title: 'Example 2' },
        ],
        categories: ['test'],
        tags: ['test'],
      };

      mockLinkUploadService.uploadLinks.mockResolvedValue({
        success: false,
        files: [successfulLink],
        errors: [{ url: 'https://example2.com', error: '上传失败' }],
      });

      await LinkController.uploadLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '部分链接上传失败',
        data: {
          files: expect.arrayContaining([
            expect.objectContaining({ linkUrl: 'https://example1.com' }),
          ]),
          total: 1,
          errors: [{ url: 'https://example2.com', error: '上传失败' }],
        },
      });
    });

    it('应该在服务抛出异常时调用next', async () => {
      mockRequest.body = {
        urls: [{ url: 'https://example.com' }],
        categories: ['test'],
        tags: ['test'],
      };

      const error = new Error('Service error');
      mockLinkUploadService.uploadLink.mockRejectedValue(error);

      await LinkController.uploadLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLinks', () => {
    it('应该成功获取链接列表', async () => {
      const links = [
        {
          _id: new ObjectId(),
          shortCode: 'ABC123',
          linkUrl: 'https://example.com',
          linkTitle: 'Example',
        },
      ];

      mockRequest.query = {};
      mockLinkUploadService.searchLinks.mockResolvedValue({
        links,
        total: 1,
      });

      await LinkController.getLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ linkUrl: 'https://example.com' }),
        ]),
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    it('应该成功获取用户链接列表', async () => {
      const userId = new ObjectId();
      const links = [
        {
          _id: userId,
          shortCode: 'ABC123',
          linkUrl: 'https://example.com',
          linkTitle: 'Example',
        },
      ];

      mockRequest.query = { uploaderId: userId.toString() };
      mockLinkUploadService.getUserLinks.mockResolvedValue({
        links,
        total: 1,
      });

      await LinkController.getLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ linkUrl: 'https://example.com' }),
        ]),
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    it('应该在用户ID无效时返回错误', async () => {
      mockRequest.query = { uploaderId: 'invalid-id' };

      await LinkController.getLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '无效的用户ID',
      });
    });
  });

  describe('searchLinks', () => {
    it('应该成功搜索链接', async () => {
      const links = [
        {
          _id: new ObjectId(),
          shortCode: 'ABC123',
          linkUrl: 'https://example.com',
          linkTitle: 'Example',
        },
      ];

      mockRequest.query = { q: 'example' };
      mockLinkUploadService.searchLinks.mockResolvedValue({
        links,
        total: 1,
      });

      await LinkController.searchLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ linkUrl: 'https://example.com' }),
        ]),
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    it('应该在缺少搜索关键词时返回错误', async () => {
      mockRequest.query = {};

      await LinkController.searchLinks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供搜索关键词',
      });
    });
  });

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
      } as Request;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该从connection.remoteAddress获取IP地址', () => {
      const req = {
        ip: undefined,
        connection: { remoteAddress: '192.168.1.1' },
      } as Request;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该从socket.remoteAddress获取IP地址', () => {
      const req = {
        ip: undefined,
        connection: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as Request;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该在无法获取IP时返回unknown', () => {
      const req = {} as Request;

      const ip = LinkController.getClientIp(req);
      expect(ip).toBe('unknown');
    });
  });
});