import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, Meta, setUnauthorizedHandler } from './api';
import { AuthUser, Permission, Role } from '../types';

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: AuthUser | null;
  permissions: Permission[];
  meta: Meta | null;
  can: (p: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  ops_lead: 'Operations lead',
  area_manager: 'Area manager',
  asset_protection: 'Asset Protection',
  technician: 'Field technician',
  viewer: 'Viewer',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const signedOut = useCallback(() => {
    setUser(null);
    setPermissions([]);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signedOut);
    api.meta().then(setMeta).catch(() => undefined);
    api
      .me()
      .then((r) => {
        setUser(r.user);
        setPermissions(r.permissions);
        setStatus('signed-in');
      })
      .catch(signedOut);
  }, [signedOut]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setUser(r.user);
    setPermissions(r.permissions);
    setStatus('signed-in');
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    signedOut();
  }, [signedOut]);

  const can = useCallback((p: Permission) => permissions.includes(p), [permissions]);

  return <AuthContext.Provider value={{ status, user, permissions, meta, can, login, logout }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
