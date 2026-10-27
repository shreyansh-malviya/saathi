import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from './api.js';

// Session state comes from GET /api/auth/me. A 401 simply means "signed out".
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await get('/auth/me');
      } catch (err) {
        if (err.status === 401) return { user: null, circles: [] };
        throw err;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  const value = {
    loading: me.isLoading,
    error: me.error,
    user: me.data?.user || null,
    circles: me.data?.circles || [],
    setSession: (data) => qc.setQueryData(['me'], data),
    refresh: () => qc.invalidateQueries({ queryKey: ['me'] }),
    logout: async () => {
      await post('/auth/logout');
      qc.clear();
      qc.setQueryData(['me'], { user: null, circles: [] });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
