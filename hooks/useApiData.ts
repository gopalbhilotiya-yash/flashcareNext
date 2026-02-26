// src/hooks/useApiData.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic type for items with ID
 */
export interface ApiItem {
  id: number;
  [key: string]: any;
}

/**
 * API Response structure
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Hook result structure
 */
export interface UseApiDataResult<T extends ApiItem> {
  // State
  data: T[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;

  // Methods
  refetch: () => Promise<void>;
  create: (item: Omit<T, 'id'>) => Promise<T | undefined>;
  update: (id: number, updates: Partial<T>) => Promise<T | undefined>;
  delete: (id: number) => Promise<boolean>;
  clear: () => void;

  // Utilities
  getById: (id: number) => T | undefined;
  filter: (predicate: (item: T) => boolean) => T[];
  search: (query: string, fields?: (keyof T)[]) => T[];
  count: () => number;
}

/**
 * Main Hook: useApiData
 * 
 * Generic hook for managing API data with CRUD operations
 * 
 * @template T - Type of items (must extend ApiItem)
 * @param endpoint - API endpoint (e.g., 'nurses', 'strikes')
 * @returns UseApiDataResult with data and methods
 * 
 * @example
 * const nurses = useApiData<Nurse>('nurses');
 * const nurse = nurses.data[0];
 * await nurses.update(1, { status: 'deployed' });
 */
export function useApiData<T extends ApiItem>(endpoint: string): UseApiDataResult<T> {
  // State
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking
  const isMountedRef = useRef(true);
  const cacheRef = useRef<T[]>([]);

  /**
   * Fetch data from API
   */
  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch ${endpoint}`);
      }

      const result: ApiResponse<T[]> = await res.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        if (isMountedRef.current) {
          setData(result.data as T[]);
          cacheRef.current = result.data as T[];
        }
      } else {
        throw new Error(result.error || `Failed to fetch ${endpoint}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to fetch ${endpoint}`;
      if (isMountedRef.current) {
        setError(message);
      }
      console.error(`[${endpoint}] Fetch error:`, message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint]);

  /**
   * Create new item
   */
  const create = useCallback(
    async (item: Omit<T, 'id'>): Promise<T | undefined> => {
      try {
        setError(null);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to create ${endpoint}`);
        }

        const result: ApiResponse<T> = await res.json();

        if (result.success && result.data) {
          const newItem = result.data as T;
          if (isMountedRef.current) {
            setData(prev => [...prev, newItem]);
            cacheRef.current = [...cacheRef.current, newItem];
          }
          return newItem;
        } else {
          throw new Error(result.error || `Failed to create ${endpoint}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to create ${endpoint}`;
        if (isMountedRef.current) {
          setError(message);
        }
        console.error(`[${endpoint}] Create error:`, message);
        return undefined;
      }
    },
    [endpoint]
  );

  /**
   * Update existing item
   */
  const update = useCallback(
    async (id: number, updates: Partial<T>): Promise<T | undefined> => {
      try {
        setError(null);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/${endpoint}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to update ${endpoint}/${id}`);
        }

        const result: ApiResponse<T> = await res.json();

        if (result.success && result.data) {
          const updatedItem = result.data as T;
          if (isMountedRef.current) {
            setData(prev =>
              prev.map(item => (item.id === id ? updatedItem : item))
            );
            cacheRef.current = cacheRef.current.map(item =>
              item.id === id ? updatedItem : item
            );
          }
          return updatedItem;
        } else {
          throw new Error(result.error || `Failed to update ${endpoint}/${id}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to update ${endpoint}/${id}`;
        if (isMountedRef.current) {
          setError(message);
        }
        console.error(`[${endpoint}] Update error:`, message);
        return undefined;
      }
    },
    [endpoint]
  );

  /**
   * Delete item
   */
  const deleteItem = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        setError(null);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/${endpoint}/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to delete ${endpoint}/${id}`);
        }

        const result: ApiResponse<T> = await res.json();

        if (result.success) {
          if (isMountedRef.current) {
            setData(prev => prev.filter(item => item.id !== id));
            cacheRef.current = cacheRef.current.filter(item => item.id !== id);
          }
          return true;
        } else {
          throw new Error(result.error || `Failed to delete ${endpoint}/${id}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to delete ${endpoint}/${id}`;
        if (isMountedRef.current) {
          setError(message);
        }
        console.error(`[${endpoint}] Delete error:`, message);
        return false;
      }
    },
    [endpoint]
  );

  /**
   * Clear all data
   */
  const clear = useCallback(() => {
    if (isMountedRef.current) {
      setData([]);
      setError(null);
      cacheRef.current = [];
    }
  }, []);

  /**
   * Get item by ID
   */
  const getById = useCallback((id: number): T | undefined => {
    return data.find(item => item.id === id);
  }, [data]);

  /**
   * Filter items by predicate
   */
  const filter = useCallback(
    (predicate: (item: T) => boolean): T[] => {
      return data.filter(predicate);
    },
    [data]
  );

  /**
   * Search in multiple fields
   */
  const search = useCallback(
    (query: string, fields?: (keyof T)[]): T[] => {
      if (!query.trim()) return data;

      const searchLower = query.toLowerCase();
      const searchFields = fields || Object.keys(data[0] || {}) as (keyof T)[];

      return data.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return value?.toString().toLowerCase().includes(searchLower);
        })
      );
    },
    [data]
  );

  /**
   * Get count of items
   */
  const count = useCallback((): number => {
    return data.length;
  }, [data]);

  /**
   * Check if data is empty
   */
  const isEmpty = data.length === 0;

  /**
   * Fetch on mount and when endpoint changes
   */
  useEffect(() => {
    isMountedRef.current = true;
    refetch();

    return () => {
      isMountedRef.current = false;
    };
  }, [refetch]);

  return {
    // State
    data,
    loading,
    error,
    isEmpty,

    // Methods
    refetch,
    create,
    update,
    delete: deleteItem,
    clear,

    // Utilities
    getById,
    filter,
    search,
    count
  };
}

/**
 * Specialized hook for Nurses
 */
export interface Nurse extends ApiItem {
  name: string;
  specialty: string;
  experience: number;
  location: string;
  status: 'available' | 'deployed';
}

export function useNurses() {
  return useApiData<Nurse>('nurses');
}

/**
 * Specialized hook for Strikes
 */
export interface Strike extends ApiItem {
  location: string;
  required: number;
  deployed: number[];
  status: 'active' | 'resolved';
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export function useStrikes() {
  return useApiData<Strike>('strikes');
}

/**
 * Specialized hook for Deployments
 */
export interface Deployment extends ApiItem {
  nurseId: number;
  strikeId: number;
  deployedAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

export function useDeployments() {
  return useApiData<Deployment>('deployments');
}

/**
 * Specialized hook for Hospitals
 */
export interface Hospital extends ApiItem {
  name: string;
  address: string;
  beds: number;
  emergencyDept: boolean;
  level: number;
}

export function useHospitals() {
  return useApiData<Hospital>('hospitals');
}