import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SiteFooter } from '../components/SiteFooter';
import { saveEntitlement } from '../services/entitlement';

export default function PlusSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const preCode = params.get('code');
  const prePlan = params.get('plan');
  const [state, setState] = useState<'working' | 'ok' | 'err'>(preCode ? 'ok' : 'working');
  const [plan, setPlan] = useState(prePlan ?? 'plus');
  const [passCode, setPassCode] = useState(preCode ?? '');
  const [message, setMessage] = useState(
    preCode ? 'Save this pass. It is how you unlock premium without an account.' : 'Confirming payment…',
  );

  useEffect(() => {
    if (!sessionId) {
      if (preCode) return;
      setState('err');
      setMessage('Missing session. Return to Plus and try again.');
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
          setMessage(data.error ?? 'Payment is not complete yet.');
          return;
        }
        saveEntitlement({
          token: data.token,
          plan: data.plan,
          expiresAt: data.expiresAt,
          passCode: data.passCode,
          passId: data.passId,
          kind: data.kind,
          seats: data.seats,
          roomCode: data.roomCode,
        });
        setPlan(data.plan);
        if (data.passCode) setPassCode(data.passCode);
        setState('ok');
        setMessage('Entitlement saved on this device. No CipherChat account was created.');
      } catch {
        if (!cancelled) {
          setState('err');
          setMessage('Network error confirming the session.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, preCode]);

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
            {state === 'ok' ? `${label(plan)} is live` : 'Finishing checkout'}
          </h1>
          <p className="mt-3 text-sm text-slate-400">{message}</p>
          {passCode && (
            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Anonymous pass — save this</div>
              <div className="mt-2 break-all font-mono text-xl tracking-[0.14em] text-cyan-glow">{passCode}</div>
              <button
                className="btn btn-ghost mt-3 w-full"
                onClick={() => void navigator.clipboard.writeText(passCode)}
              >
                Copy pass code
              </button>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <Link className="btn btn-primary" to="/">
              Open a room
            </Link>
            <Link className="btn btn-ghost" to="/plus">
              Plans
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function label(plan: string) {
  if (plan === 'pro') return 'Pro';
  if (plan === 'party') return 'Party pass';
  return 'Plus';
}
