import type { Db, ObjectId } from 'mongodb';

export interface SavedFileMeta {
  _id?: ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  filename: string;
  filepath: string;
  uploadedAt: Date;
  uploadIp: string;
}

export async function saveFileMetadata(db: Db, meta: SavedFileMeta): Promise<SavedFileMeta> {
  // 将文件元数据写入 file 集合
  const collection = db.collection<SavedFileMeta>('file');
  const doc: Omit<SavedFileMeta, '_id'> = { ...meta, uploadedAt: meta.uploadedAt ?? new Date() };
  const { insertedId } = await collection.insertOne(doc as any);
  return { ...doc, _id: insertedId };
}


