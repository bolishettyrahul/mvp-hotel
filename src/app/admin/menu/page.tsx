'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { useAuthFetcher } from '@/hooks/useRealtime';
import { Button } from '@/components/Button';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/Skeleton';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  categoryId: string;
  category: Category;
}

interface MenuGroup {
  categoryId: string;
  categoryName: string;
  items: MenuItem[];
}

export default function AdminMenuPage() {
  const authFetcher = useAuthFetcher();
  const { data: menuData, error: menuError, isLoading: menuLoading, mutate: refreshMenu } = useSWR<MenuGroup[]>('/api/menu', authFetcher);
  const { data: catData, error: catError, mutate: refreshCats } = useSWR('/api/categories', authFetcher);
  const [tabsAnimation] = useAutoAnimate();
  const [gridAnimation] = useAutoAnimate();

  const [showItemForm, setShowItemForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Category State
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  // Global Fuzzy Search
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');

  const categories: Category[] = useMemo(() => {
    if (!catData) return [];
    return [...catData].sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);
  }, [catData]);

  const currentCategoryId = activeCategoryId || (categories.length > 0 ? categories[0].id : '');

  // If there's a search query, flatten all categories and fuzzy filter them.
  // Otherwise, only show the items for the current active category tab.
  const displayItems = useMemo(() => {
    if (!menuData) return [];

    if (searchQuery.trim().length > 0) {
      const allItems = menuData.flatMap(g => g.items);
      const q = searchQuery.toLowerCase();
      return allItems.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      ).reverse();
    }

    // Tab Mode Mode
    if (!currentCategoryId) return [];
    const group = menuData.find((g) => g.categoryId === currentCategoryId);
    return group?.items ? [...group.items].reverse() : [];
  }, [menuData, currentCategoryId, searchQuery]);

  const toggleAvailability = async (item: MenuItem) => {
    setActionError('');
    try {
      const res = await fetch(`/api/menu/${item.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to update availability (${res.status})`);
      }
      mutate('/api/menu');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to toggle availability');
    }
  };

  const [deleteItemData, setDeleteItemData] = useState<{ id: string, name: string } | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const executeDeleteItem = async () => {
    if (!deleteItemData) return;
    setActionError('');
    try {
      const res = await fetch(`/api/menu/${deleteItemData.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to delete item (${res.status})`);
      }
      mutate('/api/menu');
      setDeleteItemData(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete item');
      setDeleteItemData(null);
    }
  };

  const executeDeleteCategory = async () => {
    if (!deleteCatId) return;
    setActionError('');
    try {
      const res = await fetch(`/api/categories/${deleteCatId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to delete category (${res.status})`);
      }
      mutate('/api/categories');
      mutate('/api/menu');
      setActiveCategoryId('');
      setDeleteCatId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete category');
      setDeleteCatId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
      {(menuError || catError) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-3">Failed to load menu data</p>
          <button onClick={() => { refreshMenu(); refreshCats(); }} className="text-sm px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors">Retry</button>
        </div>
      )}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-black text-stone-900 tracking-tighter">Menu Directory</h1>
          <p className="text-[15px] font-medium text-stone-500 mt-2">Manage your luxury catalog across all categories.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* Omni Search Bar */}
          <div className="relative group w-full sm:w-[320px]">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-stone-400 group-focus-within:text-[#ea580c] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search dishes, ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 text-stone-900 text-[15px] font-bold rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] placeholder:font-medium placeholder:text-stone-300 transition-all shadow-sm focus:shadow-md"
            />
            {/* Keyboard shortcut hint (visual only) */}
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <span className="text-[10px] font-bold text-stone-300 bg-stone-50 px-2 py-1 rounded-[6px] border border-stone-100 hidden md:block">
                ⌘ K
              </span>
            </div>
          </div>

          <Button variant="secondary" onClick={() => { setEditingCategory(null); setShowCatForm(true); }} className="!rounded-[16px] bg-white border-stone-200 text-stone-800 font-bold hover:bg-stone-50 min-w-[150px] min-h-[50px] shadow-sm">
            + New Category
          </Button>
          <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="!rounded-[16px] !bg-stone-900 hover:!bg-[#ea580c] text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] font-bold min-w-[150px] min-h-[50px] transition-colors duration-300">
            + Add Item
          </Button>
        </div>
      </header>

      {/* Category Tabs (Hide when searching) */}
      <div className={`mb-8 flex items-start justify-between gap-4 relative transition-all duration-300 ${searchQuery ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-2 px-1 hidden-scrollbar snap-x flex-1" ref={tabsAnimation}>
          {menuLoading && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[48px] w-32 rounded-full bg-stone-100" />)}
            </div>
          )}
          {!menuLoading && categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`snap-start whitespace-nowrap px-6 py-2.5 min-h-[48px] rounded-full text-[14px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] border ${currentCategoryId === cat.id
                ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-[0_8px_25px_rgba(234,88,12,0.3)] scale-100'
                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 scale-[0.98]'
                }`}
            >
              {cat.name}
            </button>
          ))}
          {!menuLoading && categories.length === 0 && (
            <div className="text-[14px] font-bold text-stone-400 bg-stone-50 px-6 py-3 rounded-full border border-stone-200 border-dashed">
              Your menu is empty. Start by building your first category.
            </div>
          )}
        </div>

        {/* Category Actions */}
        {!menuLoading && categories.length > 0 && currentCategoryId && (
          <button
            onClick={() => { setEditingCategory(categories.find(c => c.id === currentCategoryId)!); setShowCatForm(true); }}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-full text-[14px] font-bold mt-2 text-stone-500 hover:text-stone-900 border border-transparent hover:border-stone-200 hover:bg-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
        )}
      </div>

      {/* Search Result Context */}
      {searchQuery && (
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-[18px] font-black text-stone-900">
            Searching for &quot;{searchQuery}&quot;
          </h3>
          <span className="text-[13px] font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">{displayItems.length} found</span>
        </div>
      )}

      {/* Grid Layout Engine */}
      {menuLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[340px] w-full rounded-[24px] bg-stone-100/80" />)}
        </div>
      ) : (
        <div ref={gridAnimation}>

          {displayItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayItems.map(item => (
                <div key={item.id} className={`flex flex-col rounded-[24px] overflow-hidden bg-white ring-1 transition-all duration-300 h-full ${!item.isAvailable
                  ? 'ring-stone-100 opacity-60 grayscale-[0.5]'
                  : 'ring-stone-900/5 hover:ring-stone-900/10 hover:shadow-[0_15px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1'
                  }`}>

                  {/* Media Header */}
                  <div className="h-[200px] w-full bg-stone-100 flex items-center justify-center relative overflow-hidden shrink-0 group">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-700" alt={item.name} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 to-stone-200 border-b border-stone-100">
                        <span className="text-stone-300 font-black text-[40px] tracking-tighter opacity-50 select-none">
                          {item.name.substring(0, 2).toUpperCase()}
                        </span>
                        <svg className="w-8 h-8 text-stone-200 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Diet Badge */}
                    <div className="absolute top-4 right-4 shadow-md bg-white p-1.5 rounded-[10px] border border-stone-100">
                      <div className={`w-3.5 h-3.5 rounded-[6px] ${item.isVeg ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'} />
                    </div>

                    {/* Stock Status */}
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="bg-stone-900 text-white text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-2xl">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Text */}
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className={`font-black text-[19px] truncate tracking-tight ${!item.isAvailable ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-900'}`}>{item.name}</h3>
                    <p className="text-stone-500 text-[14px] line-clamp-2 mt-2 min-h-[42px] font-medium leading-[1.6]">{item.description}</p>

                    {/* Action Footer */}
                    <div className="mt-8 pt-5 border-t border-stone-100 flexitems-center flex justify-between">
                      <div className="font-black text-[22px] text-[#ea580c] tabular-nums tracking-tight">
                        {formatCurrency(item.price)}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAvailability(item)}
                          title={item.isAvailable ? "Mark Out of Stock" : "Publish"}
                          className={`w-10 h-10 flex items-center justify-center rounded-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${item.isAvailable ? 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700' : 'bg-[#ea580c] text-white shadow-md'
                            }`}
                        >
                          {item.isAvailable ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                        <button
                          onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                          title="Edit Item"
                          className="w-10 h-10 flex items-center justify-center rounded-[12px] bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => setDeleteItemData({ id: item.id, name: item.name })}
                          title="Delete Item"
                          className="w-10 h-10 flex items-center justify-center rounded-[12px] bg-stone-50 border border-stone-200 text-stone-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Empty States */}
              {!searchQuery && categories.length > 0 && (
                <div className="py-24 text-center border-[3px] border-dashed border-stone-200/60 rounded-[40px] bg-white/40 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl grayscale opacity-40 select-none block translate-y-1">🍽️</span>
                  </div>
                  <h3 className="text-[22px] font-black text-stone-900 mb-2 tracking-tight">This category is empty</h3>
                  <p className="text-[15px] font-medium text-stone-500 max-w-sm mx-auto mb-8">Click below to start stocking this section of your menu with beautiful dishes.</p>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                      className="!rounded-full !bg-[#ea580c] px-8 py-3.5 min-h-0 text-white shadow-elegant font-bold hover:scale-105 transition-transform"
                    >
                      + Add First Item
                    </Button>
                    <button
                      onClick={() => setDeleteCatId(currentCategoryId)}
                      className="px-6 py-3.5 rounded-full font-bold text-stone-500 bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Delete Category
                    </button>
                  </div>
                </div>
              )}

              {searchQuery && (
                <div className="py-24 text-center">
                  <h3 className="text-[22px] font-black text-stone-400 mb-2 tracking-tight">No results found for &quot;{searchQuery}&quot;</h3>
                  <p className="text-[15px] font-medium text-stone-400">Try checking for typos or searching with different keywords.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Slide-Over Drawer Portals */}
      {showCatForm && (
        <CategoryFormDrawer
          category={editingCategory}
          onClose={() => { setShowCatForm(false); setEditingCategory(null); }}
        />
      )}
      {showItemForm && (
        <ItemFormDrawer
          categories={categories}
          item={editingItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
        />
      )}

      {/* Confirms */}
      <ConfirmModal
        isOpen={!!deleteItemData}
        title="Delete Item"
        message={`Are you sure you want to delete ${deleteItemData?.name}? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={executeDeleteItem}
        onCancel={() => setDeleteItemData(null)}
      />
      <ConfirmModal
        isOpen={!!deleteCatId}
        title="Delete Category"
        message="Are you sure you want to delete this empty category?"
        confirmText="Delete"
        onConfirm={executeDeleteCategory}
        onCancel={() => setDeleteCatId(null)}
      />

      {actionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 text-sm font-medium">
          {actionError}
          <button onClick={() => setActionError('')} className="ml-3 underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}

function CategoryFormDrawer({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [name, setName] = useState(category?.name || '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');
    try {
      const url = category ? `/api/categories/${category.id}` : `/api/categories`;
      const method = category ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, sortOrder }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to save category (${res.status})`);
      }
      mutate('/api/categories');
      mutate('/api/menu');
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 w-full md:w-[460px] bg-white z-50 flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.1)] slide-in-from-right" role="dialog" aria-modal="true" aria-labelledby="cat-drawer-title">

        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-[#FCFBFA]">
          <h2 id="cat-drawer-title" className="text-[22px] font-black text-stone-900 tracking-tight">{category ? 'Modify Category' : 'New Category'}</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white border border-stone-200 hover:bg-stone-100 rounded-full transition-colors text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
            <span className="sr-only">Close</span>✕
          </button>
        </div>

        <form id="cat-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 font-medium">{formError}</div>}
          <div>
            <label htmlFor="cat-name" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Display Name</label>
            <input
              id="cat-name"
              name="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Artisanal Breads"
              required
              autoFocus
              className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 placeholder:font-medium placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-stone-50 focus:bg-white shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="cat-sort" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Sort Priority</label>
            <input
              id="cat-sort"
              name="sortOrder"
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))}
              className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-stone-50 focus:bg-white tabular-nums shadow-sm"
            />
            <p className="text-[13px] text-stone-400 mt-2 font-medium">Lower numbers appear first in the tab bar (e.g. 0, 1, 2).</p>
          </div>
        </form>

        <div className="p-8 border-t border-stone-100 bg-[#FCFBFA]">
          <Button type="submit" form="cat-form" loading={loading} className="w-full !rounded-[16px] !py-4 text-[16px] !bg-[#ea580c] text-white font-black shadow-elegant hover:brightness-110">
            {category ? 'Update Category' : 'Publish Category'}
          </Button>
        </div>
      </div>
    </>
  );
}

function ItemFormDrawer({
  categories,
  item,
  onClose,
}: {
  categories: Category[];
  item: MenuItem | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price || 0,
    isVeg: item?.isVeg ?? true,
    categoryId: item?.categoryId || categories[0]?.id || '',
    imageUrl: item?.imageUrl || '',
  });
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const update = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlertMsg('');
    try {
      const url = item ? `/api/menu/${item.id}` : '/api/menu';
      const method = item ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          imageUrl: form.imageUrl || undefined,
          description: form.description || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to save item (${res.status})`);
      }
      mutate('/api/menu');
      onClose();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white z-50 flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.1)] slide-in-from-right" role="dialog" aria-modal="true" aria-labelledby="item-drawer-title">

        {/* Cover Preview Header */}
        <div className="relative h-44 bg-stone-100 shrink-0 border-b border-stone-200 overflow-hidden">
          {form.imageUrl ? (
            <Image src={form.imageUrl} fill sizes="500px" className="object-cover" alt="Preview Header" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 to-stone-200">
              <svg className="w-10 h-10 text-stone-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-stone-400 font-bold text-[13px]">No Hero Image</span>
            </div>
          )}
          <div className="absolute top-6 left-6 right-6 flex items-start justify-between">
            {/* Fake gradient block for text legibility if image exists */}
            <div className={`absolute inset-0 -mx-6 -mt-6 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none transition-opacity ${form.imageUrl ? 'opacity-100' : 'opacity-0'}`} />
            <h2 id="item-drawer-title" className={`text-[24px] font-black tracking-tight relative z-10 ${form.imageUrl ? 'text-white' : 'text-stone-900'}`}>
              {item ? 'Modify Item' : 'Craft New Item'}
            </h2>
            <button
              onClick={onClose}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 relative z-10 backdrop-blur-md ${form.imageUrl ? 'bg-black/20 text-white hover:bg-black/40 border border-white/20' : 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-500'}`}
            >
              <span className="sr-only">Close</span>✕
            </button>
          </div>
        </div>

        <form id="item-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#FCFBFA]">
          <div>
            <label htmlFor="item-name" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Dish Name <span className="text-red-400">*</span></label>
            <input
              id="item-name"
              name="name"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. Saffron Risotto"
              required
              autoFocus
              className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 placeholder:font-medium placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-white shadow-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-4 cursor-pointer p-5 bg-white border border-stone-200 rounded-[16px] hover:border-[#ea580c] transition-colors w-full shadow-sm">
              <input
                type="checkbox"
                name="isVeg"
                checked={form.isVeg}
                onChange={e => update('isVeg', e.target.checked)}
                className="w-6 h-6 rounded-md border-stone-300 text-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0 cursor-pointer"
              />
              <div>
                <span className="text-[15px] font-black tracking-tight text-stone-900 block">Vegetarian Status</span>
                <span className="text-[13px] text-stone-400 font-medium">Is this item completely plant-based or vegetarian?</span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="item-price" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Pricing (₹) <span className="text-red-400">*</span></label>
              <input
                id="item-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 placeholder:font-medium placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-white tabular-nums shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="item-category" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Placement <span className="text-red-400">*</span></label>
              <select
                id="item-category"
                name="categoryId"
                value={form.categoryId}
                onChange={e => update('categoryId', e.target.value)}
                required
                className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-white cursor-pointer shadow-sm"
              >
                <option value="" disabled>Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="item-desc" className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Flavor Profile (Desc)</label>
            <textarea
              id="item-desc"
              name="description"
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Detail the rich textures, sourcing, and flavor notes to entice the customer..."
              rows={3}
              className="w-full px-5 py-4 border border-stone-200 rounded-[16px] text-[15px] font-bold text-stone-900 placeholder:font-medium placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] transition-all bg-white resize-none shadow-sm leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-stone-500 mb-2 uppercase tracking-widest">Dish Image (Direct Upload)</label>
            <div className="mt-2 w-full p-6 border-2 border-dashed border-stone-200 rounded-[16px] flex flex-col items-center justify-center bg-stone-50 hover:bg-stone-100 hover:border-[#ea580c] transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setLoading(true);
                  try {
                    const { getSupabase } = await import('@/lib/supabase');
                    const supabase = getSupabase();

                    // 1. Upload to Supabase Storage bucket 'menu-images'
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                      .from('menu-images')
                      .upload(fileName, file, { cacheControl: '3600', upsert: false });

                    if (uploadError) throw uploadError;

                    // 2. Get Public URL
                    const { data: publicUrlData } = supabase.storage
                      .from('menu-images')
                      .getPublicUrl(fileName);

                    update('imageUrl', publicUrlData.publicUrl);
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    setAlertMsg(`Upload failed: ${message}. Ensure you have created a public bucket named 'menu-images' in Supabase.`);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={loading}
              />

              <svg className="w-8 h-8 text-stone-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-[14px] font-bold text-stone-900 leading-tight">Click or drag image here</span>
              <span className="text-[12px] font-medium text-stone-400 mt-1">Directly uploads to high-speed CDN</span>

              {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-[14px]">
                  <span className="text-[14px] font-bold text-[#ea580c] animate-pulse">Uploading to Supabase...</span>
                </div>
              )}
            </div>
            {form.imageUrl && (
              <div className="mt-3 flex items-center justify-between bg-emerald-50 text-emerald-700 px-4 py-3 rounded-[12px] border border-emerald-100">
                <span className="text-[12px] font-bold truncate max-w-[300px]">{form.imageUrl}</span>
                <button type="button" onClick={() => update('imageUrl', '')} className="text-[12px] font-bold hover:text-emerald-900 underline">Remove</button>
              </div>
            )}
          </div>
        </form>

        <div className="p-8 border-t border-stone-100 bg-white">
          <Button type="submit" form="item-form" loading={loading} className="w-full !rounded-[16px] !py-4 text-[16px] !bg-stone-900 text-white font-black hover:!bg-[#ea580c] transition-colors duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {item ? 'Commit Changes' : 'Publish Dish'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!alertMsg}
        title="Upload Error"
        message={alertMsg}
        confirmText="OK"
        isAlert={true}
        onConfirm={() => setAlertMsg('')}
        onCancel={() => setAlertMsg('')}
      />
    </>
  );
}
