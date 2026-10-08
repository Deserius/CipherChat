import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SiteFooter } from '../components/SiteFooter';
import { saveEntitlement } from '../services/entitlement';

export default function PlusSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [state, setState] = useState<'working' | 'ok' | 'err'>('working');
  const [plan, setPlan] = useState<string>('plus');
  const [message, setMessage] = useState('Confirming payment with Stripe…');

  useEffect(() => {
    if (!sessionId) {
      setState('err');
      setMessage('Missing Stripe session. Return to Plus and try again.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/billing/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.token) {
          setState('err');
          setMessage(data.error ?? 'Stripe has not marked this payment complete yet.');
          return;
        }
        saveEntitlement({
          token: data.token,
          plan: data.plan,
          expiresAt: data.expiresAt,
        });
        setPlan(data.plan);
        setState('ok');
        setMessage('Entitlement saved on this device. No CipherChat account was created.');
      } catch {
        if (!cancelled) {
          setState('err');
          setMessage('Network error confirming the Stripe session.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo compact />
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <div className="glass rounded-3xl p-8">
          {state === 'working' && <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-glow" />}
          {state === 'ok' && <Sparkles className="mx-auto h-10 w-10 text-mint" />}
          <h1 className="mt-4 text-2xl font-semibold text-white">
            {state === 'ok' ? `${plan === 'pro' ? 'Pro' : 'Plus'} is live` : 'Finishing checkout'}
          </h1>
          <p className="mt-3 text-sm text-slate-400">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link className="btn btn-primary" to="/">
              Create a room
            </Link>
            <Link className="btn btn-ghost" to="/plus">
              Plan details
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
