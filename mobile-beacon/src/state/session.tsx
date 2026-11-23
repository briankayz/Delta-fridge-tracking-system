import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api, outbox, session } from '../api/client';
import type { Meta, User } from '../api/types';

interface SessionState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  permissions: string[];
  meta: Meta | null;
  server: string;
  pending: number;
  can: (p: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setServer: (url: string) => Promise<void>;
  refreshPending: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [server, setServerState] = useState(session.server);
  const [pending, setPending] = useState(0);

  const signedOut = useCallback(() => {
    setUser(null);
    setPermissions([]);
    setStatus('signed-out');
  }, []);

  const refreshPending = useCallback(async () => {
    setPending((await outbox.list()).length);
  }, []);

  useEffect(() => {
    session.onUnauthorized(() => {
      void session.setToken(null);
      signedOut();
    });
    (async () => {
      const { server: s, token } = await session.load();
      setServerState(s);
      api.meta().then(setMeta).catch(() => undefined);
      if (!token) return signedOut();
      try {
        const me = await api.me();
        setUser(me.user);
        setPermissions(me.permissions);
        setStatus('signed-in');
      } catch {
        // Keep the stored session when simply offline; the next request will retry.
        signedOut();
      }
    })();
  }, [signedOut]);

  // Retry queued field reports every 20 s and whenever the app returns to the foreground.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const flush = () => outbox.flush().then(setPending).catch(() => undefined);
    flush();
    const t = setInterval(flush, 20_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && flush());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [status]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login(email.trim(), password);
    await session.setToken(r.token);
    setUser(r.user);
    setPermissions(r.permissions);
    setStatus('signed-in');
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    await session.setToken(null);
    signedOut();
  }, [signedOut]);

  const setServer = useCallback(async (url: string) => {
    await session.setServer(url);
    setServerState(session.server);
    api.meta().then(setMeta).catch(() => setMeta(null));
  }, []);

  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  return (
    <Ctx.Provider value={{ status, user, permissions, meta, server, pending, can, signIn, signOut, setServer, refreshPending }}>
      {children}
    </Ctx.Provider>
  );
};

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
