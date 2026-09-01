import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'

const FIT_WEBHOOK_URL = 'https://io.fitgestao.com/webhook-test/plataforma-agentes-de-ia-fit'

export async function GET(request: Request) {
  try {
    await ensureSchema()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id é obrigatório.' }, { status: 400 })
    }

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
       ON CONFLICT (id) DO UPDATE SET agent_slug = $3, updated_at = now()`,
      [session_id, user_email ?? null, agent_type, trimmedMessage.slice(0, 80)],
    )

    await pool.query(
      'INSERT INTO fit_ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [session_id, 'user', trimmedMessage],
    )

    let message = 'Sua mensagem foi registrada. O agente estará disponível assim que o webhook for conectado.'

    try {
      const webhookResponse = await fetch(FIT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ session_id, agent_type, user_message: trimmedMessage }),
        cache: 'no-store',
      })

      const rawResponse = await webhookResponse.text()
      let responseData: unknown = rawResponse
      try {
        responseData = rawResponse ? JSON.parse(rawResponse) : null
      } catch {
        // O webhook também pode retornar texto simples.
      }

      if (webhookResponse.ok) {
        message = typeof responseData === 'string'
          ? responseData
          : typeof responseData === 'object' && responseData !== null
            ? (responseData as { message?: string; output?: string; response?: string }).message
              ?? (responseData as { output?: string }).output
              ?? (responseData as { response?: string }).response
              ?? JSON.stringify(responseData)
            : 'Mensagem processada com sucesso.'
      } else {
        console.error('[FIT AI] Webhook retornou erro:', webhookResponse.status, responseData)
      }
    } catch (webhookError) {
      console.error('[FIT AI] Erro ao chamar webhook:', webhookError)
    }

    await pool.query(
      'INSERT INTO fit_ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [session_id, 'assistant', message],
    )

    return NextResponse.json({ message })
  } catch (error) {
    console.error('[FIT AI] Erro ao processar mensagem:', error)
    return NextResponse.json({ error: 'Não foi possível conectar ao agente agora.' }, { status: 502 })
  }
}
