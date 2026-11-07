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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (!error && data) {
      setProfile(data as Profile);
    } else if (error) {
      console.error('[AuthContext] fetchProfile error:', error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          setNeedsEmailVerification(true);
          setLoading(false);
        } else {
          setNeedsEmailVerification(false);
          fetchProfile(session.user.id).finally(() => setLoading(false));
        }
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          setNeedsEmailVerification(true);
          setLoading(false);
        } else {
          setNeedsEmailVerification(false);
          (async () => {
            await fetchProfile(session.user.id);
          })();
        }
      } else {
        setProfile(null);
        setNeedsEmailVerification(false);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setNeedsEmailVerification(false);
    return { error: null };
  };

  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          display_name: displayName.trim(),
        })
        .eq('id', data.user.id);

      if (updateError) {
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: username.trim(),
            display_name: displayName.trim(),
          });
      }

      if (!data.user.email_confirmed_at) {
        setNeedsEmailVerification(true);
        return { error: null, needsVerification: true };
      }
    }

    return { error: null };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { error: error.message };
    setNeedsEmailVerification(false);
    return { error: null };
  };

  const resendOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setNeedsEmailVerification(false);
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
