'use client';

import { useState, useEffect, useRef, startTransition } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCart } from '@/hooks/useCart';
import { swrFetcher, useRealtimeSubscription } from '@/hooks/useRealtime';
import { formatCurrency } from '@/lib/utils';
import { MenuItemSkeleton } from '@/components/Skeleton';

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

function CategorySection({
  category,
  getCartQuantity,
  updateQuantity,
  addItem,
  catIndex
}: {
  category: MenuCategory;
  getCartQuantity: (id: string) => number;
  updateQuantity: (id: string, qty: number) => void;
  addItem: (item: { menuItemId: string; name: string; price: number; isVeg: boolean }) => void;
  catIndex: number;
}) {
  // This single hook magically animates all list additions/removals (Veg filtering)
  const [animationParent] = useAutoAnimate();

  return (
    <div id={`cat-${category.categoryId}`} className="mb-12 md:mb-16 scroll-mt-[140px] animate-fade-in-up" style={{ animationDelay: `${catIndex * 50}ms` }}>

      {/* Category Title - No blur, solid background for low-end GPU performance */}
      <div className="flex items-center gap-3 mb-6 sticky md:static top-[110px] md:top-auto bg-[#FCFBFA] md:bg-transparent py-3 md:py-0 z-10 -mx-5 px-5 md:mx-0 md:px-0">
        <h2 className="text-[22px] font-black tracking-tight text-stone-900">{category.categoryName}</h2>
        <span className="flex items-center justify-center bg-stone-200/60 text-stone-500 text-[11px] font-bold w-5 h-5 rounded-full">
          {category.items.length}
        </span>
      </div>

      {/* Grid Layout for Items with AutoAnimate attached to the wrapper */}
      <div ref={animationParent} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {category.items.map(item => {
          const qty = getCartQuantity(item.id);
          return (
            <div
              key={item.id}
              className={`group bg-white rounded-[20px] shadow-sm border border-stone-100 transition-all duration-300 hover:shadow-md hover:-translate-y-1 will-change-transform motion-reduce:transition-none motion-reduce:transform-none relative flex flex-col overflow-hidden ${!item.isAvailable ? 'opacity-50 grayscale' : ''
                }`}
            >
              {/* Image Hero Section */}
              {item.imageUrl && (
                <div className="w-full h-40 md:h-48 bg-stone-100 relative shrink-0 border-b border-stone-100/50 overflow-hidden">
                  <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
              )}

              <div className="flex-1 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-[16px] text-stone-800 leading-snug tracking-tight pr-6">{item.name}</h3>
                  {/* Authentic Veg/Non-Veg Indicators matching screenshot */}
                  <span className={`shrink-0 w-4 h-4 rounded-[3px] border-[1.5px] flex items-center justify-center mt-0.5 ${item.isVeg ? 'border-[#16a34a]' : 'border-[#dc2626]'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                  </span>
                </div>

                {item.description && (
                  <p className="text-[13px] text-stone-400 leading-relaxed line-clamp-2 md:line-clamp-3 mb-3">{item.description}</p>
                )}
                <div className="mt-auto pt-2">
                  <p className="text-[19px] font-black text-stone-900">{formatCurrency(item.price)}</p>
                </div>
              </div>

              {/* Controls Bottom Row - Exact screenshot matching orange */}
              <div className="mt-2">
                {!item.isAvailable ? (
                  <div className="w-full py-2.5 bg-stone-50 text-stone-300 font-bold text-center rounded-[12px] text-sm tracking-wider">
                    SOLD OUT
                  </div>
                ) : qty > 0 ? (
                  <div className="flex items-center justify-between bg-orange-50/50 rounded-[12px] p-1.5 border border-orange-100">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(item.id, qty - 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-[8px] bg-white text-orange-600 font-bold text-xl shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
                    >
                      −
                    </button>
                    <span className="font-black text-lg w-10 text-center text-orange-700">{qty}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.isVeg })}
                      className="w-10 h-10 flex items-center justify-center rounded-[8px] bg-white text-orange-600 font-bold text-xl shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full py-3 bg-[#ea580c] hover:bg-[#d94a06] text-white rounded-[12px] text-[14px] font-bold tracking-wide shadow-sm active:scale-[0.98] transition-all"
                    onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.isVeg })}
                  >
                    Add to Order
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MenuPage({ params }: { params: { tableId: string } }) {
  const { data: menuData, isLoading, mutate: refreshMenu } = useSWR<MenuCategory[]>('/api/menu', swrFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 10000,
  });

  // Instant availability updates via Supabase realtime
  useRealtimeSubscription('guest-menu', 'MenuItem', '*', () => {
    refreshMenu();
  });
  const { items: cartItems, addItem, updateQuantity, totalItems, subtotal } = useCart(params.tableId);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [vegOnly, setVegOnly] = useState(false);
  const isClickingRef = useRef(false);

  // Initialize active category once data loads
  useEffect(() => {
    if (menuData && menuData.length > 0 && !activeCategory) {
      setActiveCategory(menuData[0].categoryId);
    }
  }, [menuData, activeCategory]);

  // ScrollSpy Intersection Observer
  useEffect(() => {
    if (!menuData || menuData.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Only auto-update if the user is naturally scrolling, not if they just clicked a sidebar link
        if (isClickingRef.current) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const catId = entry.target.id.replace('cat-', '');
            // Wrap in startTransition so fast scrolling never blocks the main UI thread
            startTransition(() => {
              setActiveCategory(catId);
            });
          }
        });
      },
      {
        // Triggers when the category hits the top 15% of the viewport, effectively tracking what the user is reading
        rootMargin: '-15% 0px -70% 0px',
        threshold: 0,
      }
    );

    // Observe all category wrappers
    menuData.forEach((cat) => {
      const el = document.getElementById(`cat-${cat.categoryId}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [menuData]);

  const filteredMenu = menuData?.map(cat => ({
    ...cat,
    items: cat.items.filter(item => !vegOnly || item.isVeg),
  })).filter(cat => cat.items.length > 0);

  const getCartQuantity = (menuItemId: string) => {
    return cartItems.find(i => i.menuItemId === menuItemId)?.quantity || 0;
  };

  const scrollToCategory = (categoryId: string) => {
    isClickingRef.current = true;
    setActiveCategory(categoryId);
    document.getElementById(`cat-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Release the click lock after smooth scroll is likely finished
    setTimeout(() => {
      isClickingRef.current = false;
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#FCFBFA] font-sans text-stone-900 pb-36 md:pb-12">
      {/* Top Header - Solid white for mobile GPU optimization */}
      <header className="bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] sticky top-0 z-40 border-b border-stone-100/80">
        <div className="max-w-7xl mx-auto">
          {/* Header Top Row */}
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-stone-900">QR-Dine</h1>
              <p className="text-[11px] font-bold text-stone-400 mt-0.5 uppercase tracking-widest">
                Table {params.tableId.slice(0, 6)}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200/60 hover:bg-stone-100 transition-colors">
                <span className={`text-[13px] font-bold transition-colors ${vegOnly ? 'text-green-600' : 'text-stone-500'}`}>
                  Veg Only
                </span>
                <button
                  role="switch"
                  aria-checked={vegOnly}
                  aria-label="Veg only filter"
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${vegOnly ? 'bg-green-500' : 'bg-stone-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${vegOnly ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                </button>
              </label>

              <Link
                href={`/table/${params.tableId}/orders`}
                className="flex items-center gap-1.5 text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors bg-stone-100 hover:bg-stone-200 px-4 py-2 rounded-full active:scale-95"
              >
                <span>📋</span> Orders
              </Link>
            </div>
          </div>

          {/* Mobile Category Tabs (Hidden on Desktop) */}
          {menuData && (
            <div className="md:hidden overflow-x-auto no-scrollbar border-t border-stone-100/50">
              <div className="flex gap-2 px-5 py-3">
                {menuData.map(cat => (
                  <button
                    key={cat.categoryId}
                    onClick={() => scrollToCategory(cat.categoryId)}
                    className={`whitespace-nowrap px-4 py-2 rounded-[12px] text-[14px] font-bold transition-all active:scale-95 ${activeCategory === cat.categoryId
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'bg-stone-100/80 text-stone-500 hover:bg-stone-200 hover:text-stone-900'
                      }`}
                  >
                    {cat.categoryName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8 md:py-10 flex items-start gap-12">

        {/* Desktop Sticky Sidebar */}
        <aside className="hidden md:block w-[220px] shrink-0 sticky top-[120px]">
          <div className="bg-white rounded-[24px] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-4 pt-4 pb-3">Categories</h3>
            <div className="flex flex-col gap-1">
              {menuData?.map(cat => (
                <button
                  key={cat.categoryId}
                  onClick={() => scrollToCategory(cat.categoryId)}
                  className={`text-left px-4 py-3 rounded-[16px] text-[14px] font-bold transition-all ${activeCategory === cat.categoryId
                    ? 'bg-stone-900 text-white shadow-md'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Menu Grid Content */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => <MenuItemSkeleton key={i} />)}
            </div>
          ) : (
            filteredMenu?.map((category, catIndex) => (
              <CategorySection
                key={category.categoryId}
                category={category}
                getCartQuantity={getCartQuantity}
                updateQuantity={updateQuantity}
                addItem={addItem}
                catIndex={catIndex}
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Cart Action Pill */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-5 md:p-8 bg-gradient-to-t from-[#FCFBFA] via-[#FCFBFA]/90 to-transparent z-50 pointer-events-none pb-safe">
          <div className="max-w-7xl mx-auto flex md:justify-end pointer-events-auto">
            <Link
              href={`/table/${params.tableId}/cart`}
              className="group flex-1 md:flex-none md:w-[320px] bg-stone-900 text-white rounded-[20px] p-2 pr-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex items-center justify-between outline-none focus-visible:ring-4 focus-visible:ring-stone-500/50 active:scale-[0.98] transition-all hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <div className="w-[52px] h-[52px] bg-white/15 rounded-[16px] flex items-center justify-center">
                  <span className="font-black text-xl">{totalItems}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] leading-none mb-1">Total</span>
                  <span className="font-black text-[18px] leading-none">{formatCurrency(subtotal)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[14px] font-bold bg-white text-stone-900 px-4 py-3 rounded-[14px] transition-transform group-hover:scale-105 shadow-sm">
                Checkout
                <svg width="18" height="14" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:translate-x-1 transition-transform ml-1 mb-px">
                  <path d="M9.5 1L14.5 6M14.5 6L9.5 11M14.5 6H1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
