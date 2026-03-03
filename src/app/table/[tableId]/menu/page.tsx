'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { swrFetcher } from '@/hooks/useRealtime';
import { formatCurrency } from '@/lib/utils';
import { MenuItemSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/Button';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
}

interface MenuCategory {
  categoryId: string;
  categoryName: string;
  items: MenuItem[];
}

export default function MenuPage({ params }: { params: { tableId: string } }) {
  const { data: menuData, isLoading } = useSWR<MenuCategory[]>('/api/menu', swrFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30000, // Refresh every 30s for availability updates
  });
  const { items: cartItems, addItem, updateQuantity, totalItems, subtotal } = useCart(params.tableId);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [vegOnly, setVegOnly] = useState(false);

  useEffect(() => {
    if (menuData && menuData.length > 0 && !activeCategory) {
      setActiveCategory(menuData[0].categoryId);
    }
  }, [menuData, activeCategory]);

  const filteredMenu = menuData?.map(cat => ({
    ...cat,
    items: cat.items.filter(item => !vegOnly || item.isVeg),
  })).filter(cat => cat.items.length > 0);

  const getCartQuantity = (menuItemId: string) => {
    return cartItems.find(i => i.menuItemId === menuItemId)?.quantity || 0;
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Menu</h1>
              <p className="text-sm font-medium text-stone-500 mt-0.5">Table {params.tableId.slice(0, 6)}…</p>
            </div>
            <label className="flex items-center gap-3 text-sm cursor-pointer group">
              <span aria-hidden="true" className={`font-semibold transition-colors ${vegOnly ? 'text-green-600' : 'text-stone-400'}`}>
                Veg Only
              </span>
              <button
                role="switch"
                aria-checked={vegOnly}
                aria-label="Veg only filter"
                onClick={() => setVegOnly(!vegOnly)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${vegOnly ? 'bg-green-500' : 'bg-stone-200'
                  }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${vegOnly ? 'translate-x-[26px]' : 'translate-x-1'
                    }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Category tabs */}
        {menuData && (
          <div className="overflow-x-auto no-scrollbar pt-2">
            <div className="flex gap-2 px-5 pb-3">
              {menuData.map(cat => (
                <button
                  key={cat.categoryId}
                  onClick={() => {
                    setActiveCategory(cat.categoryId);
                    document.getElementById(`cat-${cat.categoryId}`)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  className={`whitespace-nowrap px-5 py-2.5 min-h-[44px] rounded-2xl text-sm font-bold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 ${activeCategory === cat.categoryId
                    ? 'bg-stone-900 text-white shadow-md'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Menu Items */}
      <main className="max-w-lg mx-auto px-5 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <MenuItemSkeleton key={i} />
            ))}
          </div>
        ) : (
          filteredMenu?.map((category, catIndex) => (
            <div key={category.categoryId} id={`cat-${category.categoryId}`} className="mb-10 animate-fade-in-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
              <h2 className="text-xl font-bold text-stone-900 mb-4 sticky top-[120px] bg-stone-50/95 backdrop-blur-sm py-2 z-10">
                {category.categoryName}
                <span className="text-sm font-medium text-stone-400 ml-2">
                  {category.items.length}
                </span>
              </h2>
              <div className="space-y-3">
                {category.items.map(item => {
                  const qty = getCartQuantity(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`group bg-white rounded-3xl p-5 border border-stone-100 transition-all duration-300 hover:shadow-soft hover:border-stone-200 ${!item.isAvailable ? 'opacity-50 grayscale' : ''
                        }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className={`w-3.5 h-3.5 rounded-[3px] border-2 flex items-center justify-center ${item.isVeg ? 'border-green-500 bg-green-50/50 text-green-600' : 'border-red-500 bg-red-50/50 text-red-600'
                              }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            </span>
                            <h3 className="font-bold text-stone-900 text-[17px] tracking-tight">{item.name}</h3>
                          </div>
                          {item.description && (
                            <p className="text-sm text-stone-500 mb-3 leading-relaxed line-clamp-2">{item.description}</p>
                          )}
                          <p className="font-bold text-stone-900">{formatCurrency(item.price)}</p>
                        </div>

                        <div className="flex-shrink-0 pt-1">
                          {!item.isAvailable ? (
                            <span className="text-xs text-red-500 font-bold uppercase tracking-wider bg-red-50 px-3 py-1.5 rounded-lg">Sold Out</span>
                          ) : qty > 0 ? (
                            <div className="flex items-center gap-1 bg-stone-100 rounded-2xl p-1 shadow-inner">
                              <button
                                aria-label="Decrease quantity"
                                onClick={() => {
                                  const ci = cartItems.find(i => i.menuItemId === item.id);
                                  if (ci) {
                                    updateQuantity(item.id, ci.quantity - 1);
                                  }
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-stone-900 font-bold text-xl shadow-sm cursor-pointer hover:bg-stone-50 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
                              >
                                −
                              </button>
                              <span className="text-stone-900 font-bold min-w-[28px] text-center text-lg">{qty}</span>
                              <button
                                aria-label="Increase quantity"
                                onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.isVeg })}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-stone-900 font-bold text-xl shadow-sm cursor-pointer hover:bg-stone-50 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-[90px] font-bold tracking-wide"
                              onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.isVeg })}
                            >
                              ADD
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Cart Bottom Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-50 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto animate-fade-in-up">
            <Link
              href={`/table/${params.tableId}/cart`}
              className="group flex items-center justify-between px-6 py-4 bg-stone-900 text-white rounded-2xl shadow-elegant outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-900 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 font-bold text-sm">
                  {totalItems}
                </span>
                <span className="font-bold text-lg tracking-wide">{formatCurrency(subtotal)}</span>
              </div>
              <span className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
                View Cart <span className="text-lg">→</span>
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
