'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuthFetcher } from '@/hooks/useRealtime';
import { formatCurrency, ORDER_STATUS_DISPLAY } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { useAutoAnimate } from '@formkit/auto-animate/react';

export default function AdminOrdersPage() {
  const authFetcher = useAuthFetcher();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [animationParent] = useAutoAnimate();

  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);

  const { data, isLoading, error, mutate } = useSWR(`/api/orders?${query}`, authFetcher, {
    refreshInterval: 10000,
    onError: (err) => console.error('[Admin Orders] Failed to load:', err),
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in-up">
      <header className="mb-8">
        <h1 className="text-[28px] font-black text-stone-900 tracking-tight">Order Logs</h1>
        <p className="text-[14px] font-medium text-stone-500 mt-1">Review and filter historical transactions</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-white p-2 rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-stone-100/80 w-fit">
        <button
          onClick={() => { setStatus(''); setPage(1); }}
          className={`px-4 py-2 min-h-[40px] rounded-[14px] text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${!status ? 'bg-stone-900 text-white shadow-md' : 'bg-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-900'
            }`}
        >
          All
        </button>
        <div className="mx-1 w-px h-6 bg-stone-100"></div>
        {Object.entries(ORDER_STATUS_DISPLAY).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setStatus(key); setPage(1); }}
            className={`px-4 py-2 min-h-[40px] rounded-[14px] text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${status === key ? 'bg-stone-900 text-white shadow-md' : 'bg-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table Replacement (Lux Rows) */}
      <div className="min-h-[500px]">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[88px] w-full rounded-[20px] bg-stone-100/80" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-[24px] p-8 text-center border-2 border-red-100">
            <p className="text-red-700 font-bold mb-2">Failed to load orders</p>
            <p className="text-red-600 text-sm mb-6">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button
              onClick={() => mutate()}
              className="px-6 py-3 bg-red-600 text-white rounded-[14px] font-bold hover:bg-red-700 transition-colors active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-stone-200 rounded-[24px]">
            <span className="text-4xl grayscale opacity-30 mb-4 block" aria-hidden="true">📭</span>
            <h3 className="text-[16px] font-bold text-stone-900 mb-1">No orders found</h3>
            <p className="text-[14px] text-stone-500">Wait for guests to order or change the filter.</p>
          </div>
        ) : (
          <div ref={animationParent} className="space-y-3">
            {orders.map((order: Record<string, unknown>) => {
              const orderId = order.id as string;
              const tableNum = (order.table as Record<string, unknown>)?.number as number | undefined;
              const itemCount = (order.items as Array<Record<string, unknown>>)?.length || 0;
              const totalAmount = order.totalAmount as number;
              const statusVal = order.status as string;
              const dateVal = new Date(order.createdAt as string);

              return (
                <div key={orderId} className="bg-white rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-stone-100 hover:border-stone-200 transition-colors p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group">

                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-[14px] bg-stone-50 flex items-center justify-center border border-stone-100/80 shrink-0">
                      <span className="text-[18px] font-black text-stone-900">{tableNum || '?'}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-[16px] text-stone-900">Order #{order.orderNumber as string || orderId.slice(0, 4)}</span>
                        <StatusBadge status={statusVal} variant="order" />
                      </div>
                      <div className="flex items-center gap-2 text-[13px] font-bold tracking-widest uppercase text-stone-400">
                        <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                        <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                        <span className="font-mono">{orderId.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 border-t md:border-0 border-stone-50 pt-3 md:pt-0 mt-1 md:mt-0">
                    <div className="text-left md:text-right">
                      <div className="text-[13px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">Time</div>
                      <div className="text-[15px] font-bold text-stone-900">
                        {dateVal.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[13px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">Total</div>
                      <div className="text-[18px] font-black text-[#ea580c] tabular-nums">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 bg-white p-2 rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-stone-100/80 w-fit mx-auto">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-5 py-3 min-h-[44px] rounded-[14px] text-[14px] font-bold bg-stone-50 text-stone-900 disabled:opacity-30 disabled:hover:scale-100 hover:bg-stone-100 transition-all hover:-translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Prev
          </button>
          <span className="text-[13px] font-bold text-stone-400 uppercase tracking-widest tabular-nums px-2">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="px-5 py-3 min-h-[44px] rounded-[14px] text-[14px] font-bold bg-stone-50 text-stone-900 disabled:opacity-30 disabled:hover:scale-100 hover:bg-stone-100 transition-all hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 flex items-center gap-2"
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
