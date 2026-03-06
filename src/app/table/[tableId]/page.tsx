'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TableLandingPage({ params }: { params: { tableId: string } }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        // Check if we already have a valid session for this table in localStorage
        const existingData = localStorage.getItem('qr-dine-session');
        if (existingData) {
          try {
            const parsed = JSON.parse(existingData);
            if (parsed.tableId === params.tableId && parsed.sessionId) {
              // Verify session is still active via a quick check
              const checkRes = await fetch(`/api/sessions/${parsed.sessionId}`);
              if (!checkRes.ok) {
                localStorage.removeItem('qr-dine-session');
                throw new Error('Session check failed');
              }
              const checkData = await checkRes.json();
              if (checkData.success && checkData.data.status === 'ACTIVE') {
                router.replace(`/table/${params.tableId}/menu`);
                return;
              }
              // Session expired/invalid — clear and fall through to create new one
              localStorage.removeItem('qr-dine-session');
            }
          } catch {
            localStorage.removeItem('qr-dine-session');
          }
        }

        // Create or get existing session
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: params.tableId }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error?.message || 'Failed to start session');
          setLoading(false);
          return;
        }

        // Store session info in localStorage
        localStorage.setItem('qr-dine-session', JSON.stringify({
          sessionId: data.data.id,
          tableId: params.tableId,
        }));

        // Redirect to menu
        router.replace(`/table/${params.tableId}/menu`);
      } catch {
        setError('Unable to connect. Please check your internet connection.');
        setLoading(false);
      }
    }

    initSession();
  }, [params.tableId, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center animate-pulse-slow">
          <div className="inline-block p-4 rounded-3xl bg-white shadow-soft mb-6">
            <span className="text-4xl" aria-hidden="true">🍽️</span>
          </div>
          <p className="text-stone-600 font-medium tracking-wide">Preparing your table…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="bg-white rounded-3xl shadow-elegant p-8 max-w-sm text-center">
          <div className="text-5xl mb-4" aria-hidden="true">⚠</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Oops!</h1>
          <p className="text-stone-500 mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 px-6 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all active:scale-[0.98] shadow-soft hover:shadow-elegant cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return null;
}
