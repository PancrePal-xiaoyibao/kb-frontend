import { ObjectId } from 'mongodb';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

export {};
