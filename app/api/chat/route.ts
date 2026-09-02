import { NextResponse } from 'next/server'
import { chatCollection } from '@/lib/mongodb'

const FIT_WEBHOOK_URL = process.env.FIT_WEBHOOK_URL ?? 'https://io.fitgestao.com/webhook-test/plataforma-agentes-de-ia-fit'
const FIT_WEBHOOK_SECRET = process.env.FIT_WEBHOOK_SECRET

function webhookHeaders() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    ...(FIT_WEBHOOK_SECRET ? { 'X-Webhook-Secret': FIT_WEBHOOK_SECRET } : {}),
  }
}

function webhookMessage(data: unknown) {
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const payload = data as { resposta_ia?: unknown }
    if (typeof payload.resposta_ia === 'string' && payload.resposta_ia.trim()) return payload.resposta_ia
    return JSON.stringify(data)
  }
  return 'Mensagem processada com sucesso.'
}

async function callFitWebhook(payload: Record<string, string>) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch(FIT_WEBHOOK_URL, {
      method: 'POST',
      headers: webhookHeaders(),
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
    const params = new URL(request.url).searchParams
    const sessionId = params.get('session_id')
    const collectionName = params.get('collection_name') || 'chat_messages'
    if (!sessionId) return NextResponse.json({ error: 'session_id é obrigatório.' }, { status: 400 })
    const collection = await chatCollection()
    const messages = await collection.find({ session_id: sessionId, collection_name: collectionName }, { projection: { _id: 0, role: 1, content: 1, created_at: 1 } }).sort({ created_at: 1 }).toArray()
    return NextResponse.json({ messages })
  } catch (error) {
    console.error('[FIT AI] Erro ao carregar histórico:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, agent_type, user_message, user_email } = body ?? {}
    if (typeof session_id !== 'string' || typeof agent_type !== 'string' || typeof user_message !== 'string' || !user_message.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const trimmedMessage = user_message.trim()
    const collectionName = typeof body.collection_name === 'string' && body.collection_name.trim() ? body.collection_name.trim() : 'chat_messages'
    const collection = await chatCollection()
    const messageBase = { session_id, user_id: typeof body.user_id === 'string' ? body.user_id : '', user_email: typeof user_email === 'string' ? user_email : '', collection_name: collectionName, agent_type }
    await collection.insertOne({ ...messageBase, role: 'user', content: trimmedMessage, created_at: new Date() })

    const webhookPayload = {
      session_id,
      agent_type,
      user_message: trimmedMessage,
      message: trimmedMessage,
      chatInput: trimmedMessage,
      text: trimmedMessage,
      user_id: typeof body.user_id === 'string' ? body.user_id : '',
      user_email: typeof user_email === 'string' ? user_email : '',
    }
    let message: string
    try {
      message = await callFitWebhook(webhookPayload)
    } catch (error) {
      console.error('[FIT AI] Falha no webhook:', error)
      return NextResponse.json({ error: 'O n8n não respondeu. Confirme o Listen for test event e a URL do webhook.' }, { status: 502 })
    }

    await collection.insertOne({ ...messageBase, role: 'assistant', content: message, created_at: new Date() })
    return NextResponse.json({ message, saved: true, webhook_url: FIT_WEBHOOK_URL })
  } catch (error) {
    console.error('[FIT AI] Erro ao processar mensagem:', error)
    return NextResponse.json({ error: 'Não foi possível salvar a mensagem. Confira as variáveis do PostgreSQL.' }, { status: 502 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
