'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type RealtimeCallback = (payload: Record<string, unknown>) => void;

export function useRealtimeSubscription(
  channel: string,
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback: RealtimeCallback,
  filter?: string
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let isSubscribed = true;
    let channelInstance: ReturnType<typeof supabase.channel> | null = null;

    try {
      const channelName = `${channel}-${table}${filter ? `-${filter.replace(/[^a-z0-9]/g, '')}` : ''}`;
      
      channelInstance = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as never,
          {
            event,
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          } as never,
          (payload: Record<string, unknown>) => {
            if (isSubscribed) {
              callbackRef.current(payload);
            }
          }
        )
        .subscribe(async (status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.error(`[Realtime] Subscription failed for ${table}. Status: ${status}`);
          } else if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Successfully subscribed to ${table}`);
          }
        });

      return () => {
        isSubscribed = false;
        if (channelInstance) {
          supabase.removeChannel(channelInstance);
        }
      };
    } catch (err) {
      console.error(`[Realtime] Failed to setup subscription for ${table}:`, err);
      return () => {
        if (channelInstance) {
          supabase.removeChannel(channelInstance);
        }
      };
    }
  }, [channel, table, event, filter]);
}

// Fallback polling hook for when realtime disconnects
export function useFallbackPolling(
  fetcher: () => Promise<void>,
  intervalMs = 15000,
  enabled = true
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      fetcherRef.current();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, enabled]);
}

// SWR fetcher utility
export const swrFetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // JSON parse failed, use HTTP status as error
      }
      const error = new Error(errorMessage);
      (error as unknown as Record<string, unknown>).status = res.status;
      throw error;
    }
    
    try {
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Request failed');
      return json.data;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error('Invalid response format from server');
      }
      throw parseError;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error or unknown failure');
  }
};

// Auth-aware SWR fetcher — checks login marker in localStorage, sends httpOnly cookie
function makeAuthFetcher(markerKey: string, redirectPath: string) {
  return function useSpecificAuthFetcher() {
    return useCallback(async (url: string) => {
      const isLoggedIn = typeof window !== 'undefined' ? localStorage.getItem(markerKey) : null;
      if (!isLoggedIn) {
        throw new Error('No auth token — please log in');
      }

      try {
        const res = await fetch(url, {
          credentials: 'include',
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem(markerKey);
            if (typeof window !== 'undefined') {
              window.location.href = redirectPath;
            }
            throw new Error('Session expired — please log in again');
          }

          let errorMessage = `HTTP ${res.status}`;
          try {
            const errorBody = await res.json();
            errorMessage = errorBody?.error?.message || errorMessage;
          } catch {
            // JSON parse failed, use HTTP status
          }
          const error = new Error(errorMessage);
          (error as unknown as Record<string, unknown>).status = res.status;
          throw error;
        }

        try {
          const json = await res.json();
          if (!json.success) throw new Error(json.error?.message || 'Request failed');
          return json.data;
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            throw new Error('Invalid response format from server');
          }
          throw parseError;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Network error or authentication failure');
      }
    }, []);
  };
}

// Admin fetcher — checks 'admin-logged-in' marker, redirects to /admin/login on 401
export const useAuthFetcher = makeAuthFetcher('admin-logged-in', '/admin/login');

// Kitchen fetcher — checks 'kitchen-logged-in' marker, redirects to /kitchen/login on 401
export const useKitchenAuthFetcher = makeAuthFetcher('kitchen-logged-in', '/kitchen/login');
