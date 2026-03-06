'use client';

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useKitchenAuthFetcher, useRealtimeSubscription, useFallbackPolling } from '@/hooks/useRealtime';
import { ORDER_STATUS_DISPLAY, ORDER_STATUS_FLOW } from '@/lib/utils';
import { Button } from '@/components/Button';
import { OrderCardSkeleton } from '@/components/Skeleton';
import { useAutoAnimate } from '@formkit/auto-animate/react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  specialNotes: string | null;
  totalAmount: number;
  createdAt: string;
  table: { number: number; label: string | null };
  items: OrderItem[];
}

function KitchenColumn({
  status,
  orders,
  updatingOrder,
  handleStatusUpdate
}: {
  status: string,
  orders: Order[],
  updatingOrder: string,
  handleStatusUpdate: (id: string, newStatus: string) => void
}) {
  const [animationParent] = useAutoAnimate();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold">{ORDER_STATUS_DISPLAY[status]}</h2>
        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>
      <div ref={animationParent} className="space-y-3 min-h-[150px]">
        {orders.map(order => (
          <div
            key={order.id}
            className={`bg-gray-800 rounded-lg p-4 border-l-4 ${status === 'PLACED' ? 'border-blue-500' :
                status === 'CONFIRMED' ? 'border-indigo-500' :
                  status === 'PREPARING' ? 'border-yellow-500' :
                    'border-green-500'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-lg">#{order.orderNumber}</span>
              <span className="text-sm text-gray-400">
                Table {order.table.number}
              </span>
            </div>

            {/* Time since order */}
            <p className="text-xs text-gray-500 mb-3">
              {getTimeSince(order.createdAt)}
            </p>

            {/* Items */}
            <div className="space-y-1 mb-3">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    <span className="text-orange-400 font-medium tabular-nums">{item.quantity}x</span>{' '}
                    {item.name}
                  </span>
                  {item.notes && (
                    <span className="text-yellow-400 text-xs ml-2">Note: {item.notes}</span>
                  )}
                </div>
              ))}
            </div>

            {order.specialNotes && (
              <div className="bg-yellow-900/30 text-yellow-300 text-xs rounded p-2 mb-3">
                Note: {order.specialNotes}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {ORDER_STATUS_FLOW[order.status]?.filter(s => s !== 'CANCELLED').map(nextStatus => (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant={nextStatus === 'CANCELLED' ? 'danger' : 'primary'}
                  loading={updatingOrder === order.id}
                  onClick={() => handleStatusUpdate(order.id, nextStatus)}
                  className="flex-1"
                >
                  {ORDER_STATUS_DISPLAY[nextStatus] || nextStatus}
                </Button>
              ))}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="text-center text-gray-600 py-8">
            No orders
          </div>
        )}
      </div>
    </div>
  );
}

export default function KitchenDashboard() {
  const router = useRouter();
  const authFetcher = useKitchenAuthFetcher();
  const [updatingOrder, setUpdatingOrder] = useState<string>('');

  // Check auth — kitchen uses its own login marker
  useEffect(() => {
    const loggedIn = localStorage.getItem('kitchen-logged-in');
    if (!loggedIn) {
      router.push('/kitchen/login');
    }
  }, [router]);

  const { data, error, mutate, isLoading } = useSWR(
    '/api/orders?status=PLACED&status=CONFIRMED&status=PREPARING&status=READY&limit=50',
    authFetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  // Listen for new orders in realtime
  useRealtimeSubscription(
    'kitchen-orders',
    'orders',
    '*',
    (payload) => {
      mutate();
      // Play alert sound for new orders
      if (typeof window !== 'undefined' && (payload as { eventType?: string }).eventType === 'INSERT') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => { }); // Ignore if no audio file
        } catch { }
      }
    }
  );

  // Fallback polling: poll every 30 seconds in case realtime fails
  useFallbackPolling(
    async () => {
      console.log('[Fallback] Polling orders');
      await mutate().catch(err => console.error('[Fallback] Polling failed:', err));
    },
    30000, // 30 seconds
    true   // always enabled as backup
  );

  const handleStatusUpdate = useCallback(async (orderId: string, newStatus: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        mutate();
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    } finally {
      setUpdatingOrder('');
    }
  }, [mutate]);

  const orders: Order[] = data?.orders || [];

  // Group orders by status
  const groupedOrders = {
    PLACED: orders.filter(o => o.status === 'PLACED'),
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED'),
    PREPARING: orders.filter(o => o.status === 'PREPARING'),
    READY: orders.filter(o => o.status === 'READY'),
  };

  const handleLogout = () => {
    localStorage.removeItem('kitchen-logged-in');
    document.cookie = 'kitchen-auth-token=; path=/; max-age=0';
    router.push('/kitchen/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Kitchen Dashboard</h1>
            <p className="text-xs text-gray-400" aria-live="polite">
              {orders.length} active order{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white">
            Logout
          </Button>
        </div>
      </header>

      {/* Orders Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="h-6 w-24 bg-gray-700 rounded animate-pulse" />
                <OrderCardSkeleton />
                <OrderCardSkeleton />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-gray-800 border border-red-500/30 rounded-xl p-8 text-center">
            <p className="text-red-400 font-medium mb-3">Failed to load orders</p>
            <button onClick={() => mutate()} className="text-sm px-4 py-2 bg-red-500/20 text-red-300 rounded-lg font-medium hover:bg-red-500/30 transition-colors">Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] as const).map(status => (
              <KitchenColumn
                key={status}
                status={status}
                orders={groupedOrders[status]}
                updatingOrder={updatingOrder}
                handleStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}
