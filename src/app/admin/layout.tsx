'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '⌂' },
  { href: '/admin/menu', label: 'Menu', icon: '☰' },
  { href: '/admin/tables', label: 'Tables', icon: '▦' },
  { href: '/admin/orders', label: 'Orders', icon: '☷' },
  { href: '/admin/kitchen-staff', label: 'Staff', icon: '☺' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setAuthChecked(true);
      return;
    }
    const loggedIn = localStorage.getItem('admin-logged-in');
    if (!loggedIn) {
      router.replace('/admin/login');
      return;
    }
    // Validate auth cookie with the server and check role
    fetch('/api/auth/me', {
      credentials: 'include',
    })
      .then(async res => {
        if (!res.ok) {
          localStorage.removeItem('admin-logged-in');
          document.cookie = 'auth-token=; path=/; max-age=0';
          router.replace('/admin/login');
          return;
        }
        const data = await res.json().catch(() => null);
        // Ensure the token belongs to an ADMIN — kitchen tokens must not grant access
        if (!data?.data || data.data.role !== 'ADMIN') {
          localStorage.removeItem('admin-logged-in');
          document.cookie = 'auth-token=; path=/; max-age=0';
          router.replace('/admin/login');
          return;
        }
        setIsAuthed(true);
        setAuthChecked(true);
      })
      .catch(() => {
        // Network error — do NOT grant access offline; redirect to login
        localStorage.removeItem('admin-logged-in');
        router.replace('/admin/login');
      });
  }, [pathname, router]);

  // Don't show sidebar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (!authChecked || !isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin motion-reduce:animate-none rounded-full h-10 w-10 border-4 border-orange-600 border-t-transparent mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('admin-logged-in');
    document.cookie = 'auth-token=; path=/; max-age=0';
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#FCFBFA] font-sans antialiased text-stone-900 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-[260px] flex-col bg-white border-r border-stone-100">
        <div className="px-6 py-6 border-b border-stone-100">
          <h1 className="text-[20px] font-black text-stone-900 tracking-tight">QR-Dine</h1>
          <p className="text-[11px] font-bold text-stone-400 mt-1 uppercase tracking-widest">Restaurant Admin</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[14px] text-[14px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${pathname === item.href
                ? 'bg-[#ea580c] text-white shadow-[0_4px_15px_rgba(234,88,12,0.25)]'
                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                }`}
            >
              <span aria-hidden="true" className="text-lg opacity-90 w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-6 border-t border-stone-100">
          <button
            onClick={handleLogout}
            className="w-full text-left text-[14px] font-bold text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors px-4 py-3 rounded-[14px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 flex items-center gap-3"
            aria-label="Logout"
          >
            <span className="w-5 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </span> Logout
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 md:hidden z-50 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around py-1">
          {NAV_ITEMS.slice(0, 5).map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[11px] font-bold py-2.5 px-3 min-h-[44px] justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg transition-colors ${pathname === item.href ? 'text-[#ea580c]' : 'text-stone-400 hover:text-stone-900'
                }`}
            >
              <span aria-hidden="true" className="text-xl mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
