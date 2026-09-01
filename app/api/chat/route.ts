import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { session_id, agent_type, user_message } = body
  if (!session_id || !agent_type || !user_message) return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })

  // Em produção, encaminhe este payload para o webhook n8n configurado no servidor.
  // O histórico PostgreSQL pode ser lido com: SELECT * FROM chat_memory WHERE session_id = $1
  // usando pg Pool e process.env.DATABASE_URL, sem expor credenciais ao cliente.
  return NextResponse.json({ message: `Entendido. Vou analisar sua solicitação para o agente **${agent_type}**.\n\n> ${user_message}` })
}
