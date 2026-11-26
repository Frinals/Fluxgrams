import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsEmailVerification: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>;  
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  
  // Берем профиль из памяти телефона, если он там есть
  const [profile, setProfile] = useState<Profile | null>(() => {
    const cached = localStorage.getItem('cached_profile');
    return cached ? JSON.parse(cached) : null;
  });

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!error && data) {
        setProfile(data as Profile);
        localStorage.setItem('cached_profile', JSON.stringify(data)); // Сохраняем в память
      }
    } catch (err) {
      console.error("Ошибка профиля:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // Защита от вечного зависания: максимум 5 секунд
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Пускаем сразу!
      clearTimeout(timer);

      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          setNeedsEmailVerification(true);
        } else {
          fetchProfile(session.user.id); // Грузим профиль в фоне
        }
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
      clearTimeout(timer);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setNeedsEmailVerification(false);
        localStorage.removeItem('cached_profile'); // Очищаем кэш при выходе
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user && !data.user.email_confirmed_at) {
      setNeedsEmailVerification(true);
      return { error: null, needsVerification: true };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, username, display_name: displayName });
    }
    return { error: null };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error: error?.message ?? null };
  };

  const resendOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    localStorage.removeItem('cached_profile');
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, needsEmailVerification, signIn, signUp, verifyOtp, resendOtp, signOut, refreshProfile }}>  
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
