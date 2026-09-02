import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'

const FIT_WEBHOOK_URL = process.env.FIT_WEBHOOK_URL ?? 'https://io.fitgestao.com/webhook-test/plataforma-agentes-de-ia-fit'

function webhookMessage(data: unknown) {
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const payload = data as { message?: unknown; output?: unknown; response?: unknown; text?: unknown }
    for (const value of [payload.message, payload.output, payload.response, payload.text]) {
      if (typeof value === 'string' && value.trim()) return value
    }
    return JSON.stringify(data)
  }
  return 'Mensagem processada com sucesso.'
}

async function callFitWebhook(payload: Record<string, string>) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(FIT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    })
    const raw = await response.text()
    let parsed: unknown = raw
    try { parsed = raw ? JSON.parse(raw) : null } catch { /* texto simples */ }
    if (!response.ok) throw new Error(`Webhook HTTP ${response.status}: ${raw.slice(0, 300)}`)
    return webhookMessage(parsed)
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: Request) {
  try {
    await ensureSchema()
    const sessionId = new URL(request.url).searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'session_id é obrigatório.' }, { status: 400 })
    const { rows } = await pool.query(
      'SELECT role, content, created_at FROM fit_ai_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId],
    )
    return NextResponse.json({ messages: rows })
  } catch (error) {
    console.error('[FIT AI] Erro ao carregar histórico:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema()
    const body = await request.json()
    const { session_id, agent_type, user_message, user_email } = body ?? {}
    if (typeof session_id !== 'string' || typeof agent_type !== 'string' || typeof user_message !== 'string' || !user_message.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const trimmedMessage = user_message.trim()
    await pool.query(
      `INSERT INTO fit_ai_sessions (id, user_email, agent_slug, title)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET user_email = EXCLUDED.user_email, agent_slug = EXCLUDED.agent_slug, updated_at = now()`,
      [session_id, typeof user_email === 'string' ? user_email : null, agent_type, trimmedMessage.slice(0, 80)],
    )
    await pool.query(
      'INSERT INTO fit_ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [session_id, 'user', trimmedMessage],
    )

    const webhookPayload = {
      session_id,
      agent_type,
      user_message: trimmedMessage,
      user_email: typeof user_email === 'string' ? user_email : '',
    }
    let message: string
    try {
      message = await callFitWebhook(webhookPayload)
    } catch (error) {
      console.error('[FIT AI] Falha no webhook:', error)
      message = 'Sua mensagem foi salva, mas o agente não respondeu. Verifique se o n8n está em “Listen for test event”.'
    }

    await pool.query(
      'INSERT INTO fit_ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [session_id, 'assistant', message],
    )
    return NextResponse.json({ message, webhook_url: FIT_WEBHOOK_URL })
  } catch (error) {
    console.error('[FIT AI] Erro ao processar mensagem:', error)
    return NextResponse.json({ error: 'Não foi possível salvar a mensagem. Confira as variáveis do PostgreSQL.' }, { status: 502 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
