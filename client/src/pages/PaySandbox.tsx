import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SiteFooter } from '../components/SiteFooter';
import { saveEntitlement } from '../services/entitlement';

interface Order {
  id: string;
  label: string;
  amountUsd: number;
  plan: string;
  kind: string;
  seats: number;
  hours: number;
}

export default function PaySandboxPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const orderId = params.get('order') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [card, setCard] = useState('4242424242424242');
  const [exp, setExp] = useState('12/34');
  const [cvc, setCvc] = useState('123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void fetch(`/api/billing/sandbox/order/${orderId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Order missing');
        setOrder(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [orderId]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/sandbox/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, cardNumber: card, exp, cvc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Payment failed');
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
      const q = new URLSearchParams();
      if (data.passCode) q.set('code', data.passCode);
      q.set('plan', data.plan);
      nav(`/plus/success?${q.toString()}`);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo compact />
        </Link>
        <Link className="text-sm text-slate-400 hover:text-white" to="/plus">
          Cancel
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <div className="badge mb-4">
          <Lock className="h-3.5 w-3.5" />
          Stripe test mode · no live charge
        </div>
        <h1 className="text-3xl font-semibold text-white">Test checkout</h1>
        <p className="mt-2 text-sm text-slate-400">
          This sandbox implements Stripe&apos;s documented test cards so you can exercise the full
          pass-code flow without a Stripe account. Set <code className="text-cyan-glow">STRIPE_SECRET_KEY=sk_test_…</code> to
          switch to hosted Stripe Checkout.
        </p>
        {order && (
          <div className="glass mt-5 rounded-2xl p-4 text-sm text-slate-300">
            <div className="text-white">{order.label}</div>
            <div className="mt-1 text-2xl font-semibold text-white">${order.amountUsd}</div>
            {order.kind === 'party' && (
              <div className="text-xs text-slate-500">
                {order.seats} guests · {order.hours} hours
              </div>
            )}
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>
        )}
        <form className="glass mt-5 rounded-3xl p-6" onSubmit={(e) => void pay(e)}>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Card number</label>
          <input
            className="field mb-3 font-mono tracking-widest"
            inputMode="numeric"
            autoComplete="cc-number"
            value={card}
            onChange={(e) => setCard(e.target.value.replace(/\s/g, ''))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Expiry</label>
              <input className="field" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">CVC</label>
              <input className="field" value={cvc} onChange={(e) => setCvc(e.target.value)} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Success: 4242 4242 4242 4242 · Decline: 4000 0000 0000 0002 · Any future date / any CVC.
          </p>
          <button className="btn btn-primary mt-5 w-full" type="submit" disabled={busy || !order}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Pay ${order?.amountUsd ?? 0} (test)
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
