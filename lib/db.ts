import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __fitPgPool: Pool | undefined
}

function createPool() {
  return new Pool({
    host: process.env.FIT_PG_HOST,
    port: Number(process.env.FIT_PG_PORT ?? 5432),
    database: process.env.FIT_PG_DATABASE,
    user: process.env.FIT_PG_USER,
    password: process.env.FIT_PG_PASSWORD,
    ssl: process.env.FIT_PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 5,
  })
}

export const pool = globalThis.__fitPgPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__fitPgPool = pool
}

let schemaReady: Promise<void> | null = null

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fit_ai_agents (
          slug TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fit_ai_sessions (
          id TEXT PRIMARY KEY,
          user_email TEXT,
          agent_slug TEXT NOT NULL,
          title TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fit_ai_messages (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        INSERT INTO fit_ai_agents (slug, name, description) VALUES
          ('Fluig', 'Fluig', 'Processos e documentos corporativos'),
          ('Protheus', 'Protheus', 'ERP e gestão financeira'),
          ('Service Desk', 'Service Desk', 'Suporte técnico e chamados'),
          ('Marketing', 'Marketing', 'Campanhas e materiais de marketing'),
          ('Comercial', 'Comercial', 'Vendas e relacionamento com clientes'),
          ('DHO', 'DHO', 'Desenvolvimento humano organizacional'),
          ('COT', 'COT', 'Controle operacional e treinamentos'),
          ('Diretoria', 'Diretoria', 'Indicadores e decisões estratégicas')
        ON CONFLICT (slug) DO NOTHING
      `)
    })()
  }
  return schemaReady
}
