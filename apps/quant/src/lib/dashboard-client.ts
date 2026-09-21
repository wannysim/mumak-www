import type { DashboardMode, DashboardSnapshot } from '@/lib/dashboard-schema';

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

type AuthSession = {
  userId: string;
  email?: string;
};

type DashboardClient = {
  getSession: () => Promise<AuthSession | null>;
  onAuthStateChange: (listener: (event: AuthEvent, session: AuthSession | null) => void) => () => void;
  fetchSnapshots: (mode: DashboardMode, signal: AbortSignal) => Promise<DashboardSnapshot[]>;
  requestMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export type { AuthEvent, AuthSession, DashboardClient };
