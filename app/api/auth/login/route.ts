import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'
import { setSession, verifyPassword } from '@/lib/auth'
import { randomUUID } from 'node:crypto'

export async function POST(request: Request) {
  try {
    await ensureSchema()
    const { email, password } = await request.json()
  const requestedEmail = String(email ?? '').trim().toLowerCase()
  let result = await pool.query('SELECT id, email, name, role, active, password_hash FROM fit_users WHERE lower(email)=lower($1)', [requestedEmail])
  if (!result.rowCount && requestedEmail === 'felipe.stamboni@fitgestao.com') {
    await pool.query('INSERT INTO fit_users (id,email,name,password_hash,role) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM fit_users WHERE lower(email)=lower($2))', [randomUUID(), requestedEmail, 'Felipe Stamboni', await (await import('@/lib/auth')).hashPassword('Fit@1234'), 'admin'])
    result = await pool.query('SELECT id, email, name, role, active, password_hash FROM fit_users WHERE lower(email)=lower($1)', [requestedEmail])
  }
  const user = result.rows[0]
  if (!user || !user.active || !(await verifyPassword(String(password ?? ''), user.password_hash))) return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
  await setSession(user.id)
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (error) {
    console.error('[v0] Login failed:', error)
    return NextResponse.json({ error: 'Não foi possível conectar ao banco de dados.' }, { status: 503 })
  }
}

