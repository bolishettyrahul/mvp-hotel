'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useAuthFetcher } from '@/hooks/useRealtime';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Table {
  id: string;
  number: number;
  label: string | null;
  status: string;
  capacity: number;
}

export default function AdminTablesPage() {
  const authFetcher = useAuthFetcher();
  const { data, error, isLoading } = useSWR('/api/tables', authFetcher);
  const [showForm, setShowForm] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [qrTableId, setQrTableId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const tables: Table[] = data || [];

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/tables/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Failed to delete table (${res.status})`);
      }
      mutate('/api/tables');
      setDeleteId(null);
    } catch (err) {
      console.error('Delete table failed:', err);
      setDeleteId(null);
    }
  };

  const showQR = async (tableId: string) => {
    const res = await fetch(`/api/tables/${tableId}/qr`, {
      credentials: 'include',
    });
    const d = await res.json();
    if (d.success) {
      setQrSvg(d.data.qrCodeDataUrl);
      setQrTableId(tableId);
    }
  };

  const downloadQR = () => {
    if (!qrSvg || !qrTableId) return;
    const tableNumber = tables.find(t => t.id === qrTableId)?.number || qrTableId;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new window.Image();
    img.onload = () => {
      const padding = 64;
      ctx.drawImage(img, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `Table_${tableNumber}_QR.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = qrSvg;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
        <Button onClick={() => { setEditTable(null); setShowForm(true); }}>+ Add Table</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load tables</p>
          <p className="text-red-500 text-sm mb-4">{error.message}</p>
          <Button variant="secondary" onClick={() => mutate('/api/tables')}>Retry</Button>
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          No tables yet. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tables.map(table => (
            <div key={table.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-gray-900">Table {table.number}</span>
                <StatusBadge status={table.status} variant="table" />
              </div>
              {table.label && (
                <span className="text-sm text-gray-500 mb-1">{table.label}</span>
              )}
              <span className="text-sm text-gray-400 mb-3">Capacity: {table.capacity}</span>
              <div className="flex gap-1 mt-auto">
                <button
                  onClick={() => showQR(table.id)}
                  className="flex-1 text-xs px-2 py-1.5 min-h-[36px] bg-blue-50 text-blue-600 rounded-lg font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                >
                  QR Code
                </button>
                <button
                  onClick={() => { setEditTable(table); setShowForm(true); }}
                  className="flex-1 text-xs px-2 py-1.5 min-h-[36px] bg-gray-100 text-gray-600 rounded-lg font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteId(table.id)}
                  aria-label={`Delete table ${table.number}`}
                  className="text-xs px-2 py-1.5 min-h-[36px] bg-red-50 text-red-600 rounded-lg font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {qrTableId && qrSvg && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
          <div className="bg-white rounded-xl p-6 text-center max-w-sm w-full">
            <h2 id="qr-modal-title" className="text-lg font-semibold text-gray-900 mb-4">
              Table {tables.find(t => t.id === qrTableId)?.number} QR Code
            </h2>
            <img
              src={qrSvg}
              alt={`QR code for table ${tables.find(t => t.id === qrTableId)?.number}`}
              width={256}
              height={256}
              className="inline-block bg-white p-4 rounded-lg w-64 h-64"
            />
            <p className="text-xs text-gray-400 mt-3 mb-5">Scan to start ordering</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setQrTableId(null); setQrSvg(null); }} className="flex-1 !rounded-[12px]">
                Close
              </Button>
              <Button onClick={downloadQR} className="flex-1 !rounded-[12px] !bg-[#ea580c] hover:brightness-110 text-white font-bold">
                Download PNG
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TableFormModal
          table={editTable}
          onClose={() => { setShowForm(false); setEditTable(null); }}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Table"
        message="Are you sure you want to delete this table? This action will permanently remove it and all associated QR sessions."
        confirmText="Delete Table"
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function TableFormModal({ table, onClose }: { table: Table | null; onClose: () => void }) {
  const [number, setNumber] = useState(table?.number || 0);
  const [label, setLabel] = useState(table?.label || '');
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [status, setStatus] = useState(table?.status || 'AVAILABLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // If changing to AVAILABLE, verify there's no active session
    if (table && status === 'AVAILABLE' && table.status !== 'AVAILABLE') {
      try {
        const sessionsRes = await fetch(`/api/tables/${table.id}/sessions`, {
          credentials: 'include',
        });
        const sessionsData = await sessionsRes.json();

        if (sessionsData.success) {
          const activeSessions = (sessionsData.data || []).filter(
            (s: Record<string, unknown>) => s.status === 'ACTIVE'
          );

          if (activeSessions.length > 0) {
            setError(
              `Cannot mark as available: ${activeSessions.length} active session(s) exist. ` +
              `Please ask guests to complete their dining or manually expire the session first.`
            );
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to check sessions:', err);
        setError('Could not verify active sessions. Please try again.');
        setLoading(false);
        return;
      }
    }

    const url = table ? `/api/tables/${table.id}` : '/api/tables';
    const method = table ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        number: Number(number),
        label: label || undefined,
        capacity: Number(capacity),
        ...(table ? { status } : {}),
      }),
    });

    const data = await res.json();
    if (!data.success) {
      setError(data.error?.message || 'Failed');
      setLoading(false);
      return;
    }

    mutate('/api/tables');
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="table-form-title">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
        <h2 id="table-form-title" className="text-lg font-semibold text-gray-900">{table ? 'Edit Table' : 'Add Table'}</h2>

        <div>
          <label htmlFor="tbl-number" className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
          <input
            id="tbl-number"
            name="number"
            type="number"
            min="1"
            value={number}
            onChange={e => setNumber(Number(e.target.value))}
            placeholder="1"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          />
        </div>
        <div>
          <label htmlFor="tbl-label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            id="tbl-label"
            name="label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Window, Patio\u2026"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          />
        </div>
        <div>
          <label htmlFor="tbl-capacity" className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
          <input
            id="tbl-capacity"
            name="capacity"
            type="number"
            min="1"
            value={capacity}
            onChange={e => setCapacity(Number(e.target.value))}
            placeholder="4"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          />
        </div>
        {table && (
          <div>
            <label htmlFor="tbl-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="tbl-status"
              name="status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {table ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
