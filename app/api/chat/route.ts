import { NextResponse } from 'next/server'

const FIT_WEBHOOK_URL = 'https://io.fitgestao.com/webhook-test/plataforma-agentes-de-ia-fit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, agent_type, user_message } = body ?? {}

    if (typeof session_id !== 'string' || typeof agent_type !== 'string' || typeof user_message !== 'string' || !user_message.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const webhookResponse = await fetch(FIT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        session_id,
        agent_type,
        user_message: user_message.trim(),
      }),
      cache: 'no-store',
    })

    const rawResponse = await webhookResponse.text()
    let responseData: unknown = rawResponse
    try {
      responseData = rawResponse ? JSON.parse(rawResponse) : null
    } catch {
      // O webhook também pode retornar texto simples.
    }

    if (!webhookResponse.ok) {
      return NextResponse.json({ error: 'O webhook não conseguiu processar a mensagem.', details: responseData }, { status: 502 })
    }

    const message = typeof responseData === 'string'
      ? responseData
      : typeof responseData === 'object' && responseData !== null
        ? (responseData as { message?: string; output?: string; response?: string }).message
          ?? (responseData as { output?: string }).output
          ?? (responseData as { response?: string }).response
          ?? JSON.stringify(responseData)
        : 'Mensagem processada com sucesso.'

    return NextResponse.json({ message })
  } catch (error) {
    console.error('[FIT AI] Erro ao chamar webhook:', error)
    return NextResponse.json({ error: 'Não foi possível conectar ao agente agora.' }, { status: 502 })
  }
}
