'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Users, TreePine, FileText, MessageCircle, Settings, LogOut, Shield, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/tree', icon: TreePine, label: 'Pohon Keluarga' },
  { href: '/members', icon: Users, label: 'Anggota' },
  { href: '/documents', icon: FileText, label: 'Dokumen' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/dashboard/settings', icon: Settings, label: 'Pengaturan' },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && !pathname?.startsWith('/auth') && pathname !== '/') {
      router.push('/auth/login');
    }
  }, [pathname, router]);

  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/';

  if (isAuthPage) {
    return children;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="font-bold text-2xl text-gray-900">CeritaKeluarga</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={logout} className="text-gray-600 hover:text-gray-900">
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6 flex-1 min-h-[calc(100vh-120px)]">
        <div className="flex h-full gap-6">
          <nav className={`w-56 flex-shrink-0 transition-all duration-300 md:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg font-medium transition-all ${
                      pathname === item.href 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-gray-700 hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
          <nav className={`fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute left-0 top-0 h-full w-56 bg-white border-r border-gray-200 p-4">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg font-medium transition-all ${
                      pathname === item.href 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-gray-700 hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
</nav>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}