import { Pool } from 'pg'

declare global { var __fitPgPool: Pool | undefined }
function createPool() { return new Pool({ host: process.env.FIT_PG_HOST, port: Number(process.env.FIT_PG_PORT ?? 5432), database: process.env.FIT_PG_DATABASE, user: process.env.FIT_PG_USER, password: process.env.FIT_PG_PASSWORD, ssl: process.env.FIT_PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined, max: 5 }) }
export const pool = globalThis.__fitPgPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis.__fitPgPool = pool
let schemaReady: Promise<void> | null = null
export function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','manager','user')), active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_agents (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_sessions (id TEXT PRIMARY KEY, user_id TEXT, user_email TEXT, agent_slug TEXT NOT NULL, title TEXT, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_messages (id SERIAL PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT, role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE INDEX IF NOT EXISTS fit_ai_messages_session_idx ON fit_ai_messages(session_id, id)`)
    await pool.query(`INSERT INTO fit_ai_agents (slug,name,description) VALUES ('Fluig','Fluig','Processos e documentos corporativos'),('Protheus','Protheus','ERP e gestão financeira'),('Service Desk','Service Desk','Suporte técnico e chamados'),('Marketing','Marketing','Campanhas e materiais de marketing'),('Comercial','Comercial','Vendas e relacionamento'),('DHO','DHO','Desenvolvimento humano'),('COT','COT','Controle operacional'),('Diretoria','Diretoria','Indicadores estratégicos') ON CONFLICT (slug) DO NOTHING`)
  })()
  return schemaReady
}
