import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function RootPage() {
  try {
    const session = await getServerSession(authOptions);
    if (session) return redirect('/dashboard');
  } catch {
    // ignore — unauthenticated users go to login
  }
  redirect('/login');
}
