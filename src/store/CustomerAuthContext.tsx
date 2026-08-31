import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type CustomerProfile = {
  fullName: string;
  phone: string;
  email: string;
};

type CustomerAuthValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: CustomerProfile | null;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (fullName: string, phone: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('full_name, phone, email')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      setProfile({ fullName: '', phone: '', email });
      return;
    }

    if (data) {
      setProfile({
        fullName: data.full_name ?? '',
        phone: data.phone ?? '',
        email: data.email ?? email,
      });
    } else {
      // Profile doesn't exist yet — create a minimal one
      const { error: insertError } = await supabase
        .from('customer_profiles')
        .insert({ id: uid, email, full_name: '', phone: '' });
      if (!insertError) {
        setProfile({ fullName: '', phone: '', email });
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession?.user) {
          // Auto-redirect admin users to /admin when they sign in via the
          // storefront auth flow. Only triggers on SIGNED_IN events, not on
          // initial session restoration, so admins browsing the store aren't
          // yanked away. app_metadata.is_admin is server-only and trusted.
          if (
            event === 'SIGNED_IN' &&
            newSession.user.app_metadata?.is_admin === true &&
            !window.location.pathname.startsWith('/admin')
          ) {
            window.location.href = '/admin';
            return;
          }
          await loadProfile(newSession.user.id, newSession.user.email ?? '');
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, phone: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone },
        },
      });
      if (error) throw error;
      // Profile is created automatically by a database trigger
      // (handle_new_customer_profile) that fires AFTER INSERT on auth.users.
      // We do NOT insert from the client because RLS requires auth.uid() = id,
      // and there may be no session yet if email confirmation is enabled.
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (fullName: string, phone: string) => {
      if (!session?.user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('customer_profiles')
        .update({ full_name: fullName, phone })
        .eq('id', session.user.id);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, fullName, phone } : { fullName, phone, email: '' }));
    },
    [session]
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id, session.user.email ?? '');
    }
  }, [session, loadProfile]);

  const user = session?.user ?? null;

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        signUp,
        signIn,
        signOut,
        updateProfile,
        changePassword,
        refreshProfile,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth deve ser usado dentro de CustomerAuthProvider');
  return ctx;
}
