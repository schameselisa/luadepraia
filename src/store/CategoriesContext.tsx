import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { CategoryRow } from '@/types';
import { fetchCategories } from '@/lib/data';

type CategoriesContextValue = {
  categories: CategoryRow[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch {
      // keep previous list on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CategoriesContext.Provider value={{ categories, loading, refresh }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories deve ser usado dentro de CategoriesProvider');
  return ctx;
}
