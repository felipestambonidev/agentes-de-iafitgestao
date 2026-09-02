import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { ensureSchema, pool } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST() {
  await ensureSchema()
  const email = 'felipe.stamboni@fitgestao.com'
  const exists = await pool.query('SELECT id FROM fit_users WHERE email=$1', [email])
  if (!exists.rowCount) await pool.query('INSERT INTO fit_users (id,email,name,password_hash,role) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), email, 'Felipe Stamboni', await hashPassword('Fit@1234'), 'admin'])
  return NextResponse.json({ ok: true })
}
