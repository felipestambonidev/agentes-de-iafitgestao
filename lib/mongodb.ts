import { MongoClient, type Db } from 'mongodb'

const globalForMongo = globalThis as typeof globalThis & { mongoClient?: MongoClient }
let dbPromise: Promise<Db> | undefined

export function getMongoDb() {
  dbPromise ??= Promise.resolve().then(async () => {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI não configurada.')
    const client = globalForMongo.mongoClient ?? new MongoClient(uri)
    if (process.env.NODE_ENV !== 'production') globalForMongo.mongoClient = client
    await client.connect()
    return client.db('fit_gestao_chats')
  })
  return dbPromise
}

export type StoredMessage = {
  session_id: string
  user_id: string
  user_email: string
  collection_name: string
  agent_type: string
  role: 'user' | 'assistant'
  content: string
  created_at: Date
}

export async function chatCollection() {
  const db = await getMongoDb()
  const collection = db.collection<StoredMessage>('chat_messages')
  await collection.createIndex({ session_id: 1, collection_name: 1, created_at: 1 })
  await collection.createIndex({ user_id: 1, collection_name: 1, created_at: -1 })
  return collection
}
