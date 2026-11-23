import React, { useState } from 'react';
import { FlaskConical, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../services/auth';
import { Button, DeltaMark } from '../components/ui';

const DEMO_ACCOUNTS = [
  ['ops@delta.demo', 'Operations lead'],
  ['security@delta.demo', 'Asset Protection'],
  ['north.manager@delta.demo', 'Area manager (Harare North)'],
  ['tech@delta.demo', 'Field technician'],
  ['admin@delta.demo', 'Administrator'],
];

export const LoginPage: React.FC = () => {
  const { login, meta } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-delta-900 text-white p-12">
        <div className="flex items-center gap-3">
          <DeltaMark size={40} />
          <div>
            <div className="font-brand text-2xl font-semibold">Delta</div>
            <div className="text-xs uppercase tracking-[0.18em] text-gold-300">Asset Guard</div>
          </div>
        </div>
        <div className="max-w-md">
          <div className="h-px w-16 bg-gold-400 mb-6" />
          <h1 className="text-3xl font-semibold leading-tight">Every Delta cooler, accounted for.</h1>
          <p className="mt-4 text-delta-100/80 leading-relaxed">
            Live location, power and theft risk for trade coolers across Delta Beverages’ retail network, with a clear
            response workflow for every alert.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-delta-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Authorised Delta Beverages staff only. Activity is logged.
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-10 h-10 rounded-md bg-delta-900 flex items-center justify-center">
              <DeltaMark size={24} />
            </span>
            <span className="font-brand text-xl font-semibold text-delta-700">Delta Asset Guard</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your Delta Asset Guard account.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500 text-sm"
              />
            </label>
            {error && (
              <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                {error}
              </div>
            )}
            <Button type="submit" variant="primary" icon={LogIn} className="w-full h-10" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {meta?.demo_mode && (
            <div className="mt-8 rounded-lg border border-gold-300 bg-gold-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gold-700">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                Demo accounts
              </div>
              <p className="mt-1 text-xs text-slate-600">Password for all: the DEMO_PASSWORD in backend/.env</p>
              <ul className="mt-2 space-y-1">
                {DEMO_ACCOUNTS.map(([e, label]) => (
                  <li key={e}>
                    <button
                      type="button"
                      onClick={() => setEmail(e)}
                      className="text-left text-xs text-delta-700 hover:underline"
                    >
                      {e} <span className="text-slate-500">· {label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
