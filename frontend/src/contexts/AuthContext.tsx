import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo mode: single static user, no real auth.
    const demoUser: SupabaseUser = {
      id: 'demoUser',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'demo@flowpilot.local',
      phone: '',
      role: 'authenticated',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      factors: [],
      identities: [],
      is_anonymous: false,
    } as unknown as SupabaseUser;

    setUser(demoUser);
    setSession(null);
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Demo: always "succeeds" and keeps the static user.
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    // Demo: no-op, just report success.
    return { error: null };
  };

  const signOut = async () => {
    // Demo: keep the same user; no real sign-out.
    return;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
