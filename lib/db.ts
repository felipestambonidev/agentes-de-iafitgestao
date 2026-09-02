import { Pool } from 'pg'

declare global { var __fitPgPool: Pool | undefined; var __fitPgPoolSignature: string | undefined }

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável ${name} não está configurada. Use as variáveis FIT_PG_* no arquivo .env.local.`)
  return value
}

function validateEnv() {
  const host = requiredEnv('FIT_PG_HOST')
  const database = requiredEnv('FIT_PG_DATABASE')
  const user = requiredEnv('FIT_PG_USER')
  const password = requiredEnv('FIT_PG_PASSWORD')
  const port = Number(process.env.FIT_PG_PORT?.trim() || '5432')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FIT_PG_PORT inválida.')
  return { host, database, user, password, port }
}

function createPool() {
  const config = {
    host: process.env.FIT_PG_HOST?.trim(),
    port: Number(process.env.FIT_PG_PORT?.trim() || '5432'),
    database: process.env.FIT_PG_DATABASE?.trim(),
    user: process.env.FIT_PG_USER?.trim(),
    password: process.env.FIT_PG_PASSWORD?.trim(),
    ssl: process.env.FIT_PG_SSL?.trim() === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 5,
  }
  return new Pool(config)
}
function getPool() {
  const signature = [
    process.env.FIT_PG_HOST,
    process.env.FIT_PG_PORT,
    process.env.FIT_PG_DATABASE,
    process.env.FIT_PG_USER,
    process.env.FIT_PG_PASSWORD,
    process.env.FIT_PG_SSL,
  ].join('|')

  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis.__fitPgPool || globalThis.__fitPgPoolSignature !== signature) {
      globalThis.__fitPgPool?.end().catch(() => {})
      globalThis.__fitPgPool = createPool()
      globalThis.__fitPgPoolSignature = signature
    }
    return globalThis.__fitPgPool
  }

  return createPool()
}

// Proxy so every call re-checks env vars, avoiding a stale connection
// cached from before .env was fully configured during local development.
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const current = getPool()
    const value = Reflect.get(current, prop, receiver)
    return typeof value === 'function' ? value.bind(current) : value
  },
})
let schemaReady: Promise<void> | null = null
export function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    validateEnv()
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','manager','user')), active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_agents (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_sessions (id TEXT PRIMARY KEY, user_id TEXT, user_email TEXT, agent_slug TEXT NOT NULL, title TEXT, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS fit_ai_messages (id SERIAL PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT, role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now())`)
    const { rows: existingIndexes } = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'fit_ai_messages_session_idx'`
    )
    if (existingIndexes.length === 0) {
      await pool.query(`CREATE INDEX fit_ai_messages_session_idx ON fit_ai_messages(session_id, id)`)
    }
    const agents = [
      ['Fluig', 'Fluig', 'Processos e documentos corporativos'],
      ['Protheus', 'Protheus', 'ERP e gestão financeira'],
      ['Service Desk', 'Service Desk', 'Suporte técnico e chamados'],
      ['Marketing', 'Marketing', 'Campanhas e materiais de marketing'],
      ['Comercial', 'Comercial', 'Vendas e relacionamento'],
      ['DHO', 'DHO', 'Desenvolvimento humano'],
      ['COT', 'COT', 'Controle operacional'],
      ['Diretoria', 'Diretoria', 'Indicadores estratégicos'],
    ]
    for (const [slug, name, description] of agents) {
      await pool.query('INSERT INTO fit_ai_agents (slug, name, description) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM fit_ai_agents WHERE slug = $1)', [slug, name, description])
    }
  })().catch((error) => {
    schemaReady = null
    throw error
  })
  return schemaReady
}
