'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils';
import { Button } from '@/components/Button';

export default function CartPage({ params }: { params: { tableId: string } }) {
  const router = useRouter();
  const { items, updateQuantity, updateNotes, removeItem, clearCart, subtotal } = useCart(params.tableId);
  const [specialNotes, setSpecialNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');

    try {
      // Get session from localStorage
      const sessionData = localStorage.getItem('qr-dine-session');
      if (!sessionData) {
        setError('Session expired. Please scan the QR code again.');
        return;
      }

      const { sessionId, tableId } = JSON.parse(sessionData);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          sessionId,
          tableId,
          items: items.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes,
          })),
          specialNotes: specialNotes || undefined,
          idempotencyKey: generateIdempotencyKey(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to place order');
        return;
      }

      clearCart();
      router.push(`/table/${params.tableId}/order-status?orderId=${data.data.id}`);
    } catch {
      setError('Unable to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-center animate-fade-in-up">
          <div className="text-6xl mb-6 grayscale opacity-80 mix-blend-multiply">🛒</div>
          <h2 className="text-2xl font-bold text-stone-900 mb-3 tracking-tight">Your cart is empty</h2>
          <p className="text-stone-500 mb-8 font-medium">Add items from the menu to get started.</p>
          <Link
            href={`/table/${params.tableId}/menu`}
            className="inline-block py-4 px-8 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all active:scale-[0.98] shadow-elegant tracking-wide"
          >
            Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4 border-b border-stone-100">
          <Link href={`/table/${params.tableId}/menu`} className="text-stone-400 hover:text-stone-900 transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-stone-100">
            ←
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Your Cart</h1>
          <span className="text-sm font-medium text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">{items.length} items</span>
        </div>
      </header>

      {/* Cart Items */}
      <main className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {items.map((item, index) => (
          <div key={item.menuItemId} className="bg-white rounded-3xl p-5 shadow-sm border border-stone-100 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className={`w-3 h-3 rounded-[3px] border-2 flex items-center justify-center ${item.isVeg ? 'border-green-500 bg-green-50 text-green-600' : 'border-red-500 bg-red-50 text-red-600'
                    }`}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                  </span>
                  <h3 className="font-bold text-stone-900 text-[17px] tracking-tight">{item.name}</h3>
                </div>
                <p className="text-sm font-medium text-stone-500">{formatCurrency(item.price)} each</p>
              </div>
              <button
                onClick={() => removeItem(item.menuItemId)}
                aria-label="Remove item"
                className="text-stone-300 hover:text-red-500 hover:bg-red-50 text-sm w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mt-5 mb-4 bg-stone-50/50 p-2 rounded-2xl">
              <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm border border-stone-100 p-1 pl-2 pr-2">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 font-medium text-lg"
                >
                  −
                </button>
                <span className="font-bold text-stone-900 min-w-[32px] text-center tabular-nums text-lg">{item.quantity}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 font-medium text-lg"
                >
                  +
                </button>
              </div>
              <span className="font-bold text-stone-900 text-lg tracking-tight pr-2">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>

            <input
              type="text"
              name="item-note"
              aria-label="Note for this item"
              placeholder="Add note (e.g., extra spicy)…"
              value={item.notes || ''}
              onChange={e => updateNotes(item.menuItemId, e.target.value)}
              className="w-full text-sm border-b border-stone-200 bg-transparent px-1 py-2 text-stone-900 placeholder-stone-400 focus-visible:outline-none focus-visible:border-stone-900 transition-colors"
              maxLength={200}
            />
          </div>
        ))}

        {/* Special Notes */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 animate-fade-in-up" style={{ animationDelay: `${items.length * 50}ms` }}>
          <label className="block text-sm font-bold text-stone-900 mb-3">
            Special instructions for the kitchen
          </label>
          <textarea
            value={specialNotes}
            onChange={e => setSpecialNotes(e.target.value)}
            name="special-notes"
            placeholder="Any allergies or special requests…"
            className="w-full text-sm bg-stone-50 border-none rounded-2xl px-4 py-4 text-stone-900 placeholder-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 resize-none transition-shadow"
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 animate-fade-in-up" style={{ animationDelay: `${(items.length + 1) * 50}ms` }}>
          <h3 className="font-bold text-stone-900 mb-4 tracking-tight">Order Summary</h3>
          <div className="space-y-3 test-base">
            <div className="flex justify-between font-medium text-stone-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between font-medium text-stone-500">
              <span>Taxes</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-t border-stone-100 pt-4 mt-4 flex justify-between items-center">
              <span className="font-bold text-stone-900">Estimated Total</span>
              <span className="font-bold text-xl text-stone-900 tracking-tight">{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}
      </main>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-50 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto animate-fade-in-up" style={{ animationDelay: `${(items.length + 2) * 50}ms` }}>
          <Button
            size="lg"
            className="w-full bg-stone-900 hover:bg-stone-800 text-white shadow-elegant hover:scale-[0.98] outline-none focus-visible:ring-stone-900 focus-visible:ring-offset-stone-50"
            onClick={handlePlaceOrder}
            loading={loading}
          >
            Place Order • {formatCurrency(subtotal)}
          </Button>
        </div>
      </div>
    </div>
  );
}
