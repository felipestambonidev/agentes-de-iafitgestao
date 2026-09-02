import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { getCurrentUser } from '@/lib/auth'
import AdminUsers from '@/components/admin-users'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/')
  if (user.role !== 'admin') redirect('/')
  return <AdminUsers />
}
