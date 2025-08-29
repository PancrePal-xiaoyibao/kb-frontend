import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | null = null;
let databaseInstance: Db | null = null;

export async function initDatabase(connectionString: string): Promise<Db> {
  if (databaseInstance && mongoClient) {
    return databaseInstance;
  }

  mongoClient = new MongoClient(connectionString);
  await mongoClient.connect();
  databaseInstance = mongoClient.db();
  return databaseInstance;
}

export function getDatabase(): Db {
  if (!databaseInstance) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return databaseInstance;
}

export async function closeDatabase(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    databaseInstance = null;
  }
}

