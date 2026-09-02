import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { pool, ensureSchema } from '@/lib/db'

const scrypt = promisify(scryptCallback)
const COOKIE = 'fit_ai_session'
const SECRET = process.env.BETTER_AUTH_SECRET ?? 'development-only-secret-change-me'

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const key = (await scrypt(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  return expected.length === key.length && timingSafeEqual(expected, key)
}

function sign(value: string) {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

export function createToken(userId: string) {
  const payload = `${userId}.${Date.now() + 1000 * 60 * 60 * 24 * 7}`
  return `${payload}.${sign(payload)}`
}

export function readToken(token: string | undefined) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expires, signature] = parts
  if (Number(expires) < Date.now() || sign(`${userId}.${expires}`) !== signature) return null
  return userId
}

export async function getCurrentUser() {
  await ensureSchema()
  const jar = await cookies()
  const userId = readToken(jar.get(COOKIE)?.value)
  if (!userId) return null
  const result = await pool.query('SELECT id, email, name, role, active FROM fit_users WHERE id = $1', [userId])
  const user = result.rows[0]
  return user?.active ? user : null
}

export async function setSession(userId: string) {
  const jar = await cookies()
  jar.set(COOKIE, createToken(userId), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export { COOKIE } 
