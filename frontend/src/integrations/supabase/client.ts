// Lightweight demo Supabase client for FlowPilot frontend.
// For this single-user demo, we don't actually talk to Supabase, but
// some UI components still import `supabase`. To avoid runtime errors
// when env vars are missing, we provide a minimal no-op implementation.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Very small helper that mimics the Supabase query builder shape used in the UI.
const createQueryBuilder = () => {
  const builder = {
    select: (() => builder) as AnyFn,
    eq: (() => builder) as AnyFn,
    order: (() => builder) as AnyFn,
    single: (async () => ({ data: null, error: null })) as AnyFn,
    maybeSingle: (async () => ({ data: null, error: null })) as AnyFn,
    insert: (async () => ({ data: null, error: null })) as AnyFn,
    update: (async () => ({ data: null, error: null })) as AnyFn,
  };
  return builder;
};

export const supabase = {
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAuthStateChange: (callback: AnyFn): { data: { subscription: { unsubscribe: AnyFn } } } => {
      // Immediately report "no session" and provide a no-op unsubscribe.
      callback('INITIAL_SESSION', null);
      return {
        data: {
          subscription: { unsubscribe: () => undefined },
        },
      };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signUp: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: (_table: string) => createQueryBuilder(),
};
