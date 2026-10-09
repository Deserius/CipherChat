import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Crown, Loader2, Shield, Sparkles, Ticket } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SiteFooter } from '../components/SiteFooter';
import { PARTY_PACKS, PLAN_LIMITS, type PriceKey } from '@shared/billing';
import { clearEntitlement, getEntitlement, entitlementToken, passCode, saveEntitlement } from '../services/entitlement';

type Busy = PriceKey | 'portal' | 'redeem' | 'refund' | null;

export default function PlusPage() {
  const [params] = useSearchParams();
  const canceled = params.get('canceled') === '1';
  const [sandbox, setSandbox] = useState(false);
  const [stripe, setStripe] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(getEntitlement());
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'party' | 'plus'>('party');

  useEffect(() => {
    void fetch('/api/billing/plans')
      .then((r) => r.json())
      .then((d) => {
        setEnabled(Boolean(d.enabled));
        setSandbox(Boolean(d.sandbox));
        setStripe(Boolean(d.stripe));
      })
      .catch(() => setError('Unable to load plans.'));
  }, []);

  async function checkout(priceKey: PriceKey, extra?: { extraSeats?: number }) {
    setError(null);
    setBusy(priceKey);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceKey,
          extraSeats: extra?.extraSeats,
          attachPassId: extra?.extraSeats ? mine?.passId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Checkout could not start.');
        return;
      }
      if (data.url) window.location.assign(data.url);
    } catch {
      setError('Network error starting checkout.');
    } finally {
      setBusy(null);
    }
  }

  async function redeem() {
    setBusy('redeem');
    setError(null);
    try {
      const res = await fetch('/api/billing/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not redeem.');
        return;
      }
      saveEntitlement({
        token: data.token,
        plan: data.plan,
        expiresAt: data.expiresAt,
        passCode: code.trim().toUpperCase(),
        passId: data.passId,
        kind: data.kind,
        seats: data.seats,
        roomCode: data.roomCode,
      });
      setMine(getEntitlement());
      setCode('');
    } catch {
      setError('Network error redeeming pass.');
    } finally {
      setBusy(null);
    }
  }

  async function refund() {
    const pc = passCode();
    if (!pc) {
      setError('No pass code on this device.');
      return;
    }
    setBusy('refund');
    setError(null);
    try {
      const res = await fetch('/api/billing/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCode: pc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Refund failed.');
        return;
      }
      setError(null);
      alert(`Refunded $${data.refundedUsd}${data.sandbox ? ' (sandbox)' : ''}.`);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(null);
    }
  }

  async function portal() {
    const token = entitlementToken();
    if (!token) return;
    setBusy('portal');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cipher-Entitlement': token },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Portal unavailable.');
        return;
      }
      if (data.url) window.location.assign(data.url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="flex gap-4 text-sm text-slate-400">
          <Link className="hover:text-white" to="/help">
            Help
          </Link>
          <Link className="hover:text-white" to="/">
            Home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        <div className="badge mb-5">
          <Crown className="h-3.5 w-3.5" />
          {stripe ? 'Stripe Checkout' : 'Stripe test sandbox'} · no CipherChat account
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Pay for a night.
          <span className="block bg-gradient-to-r from-cyan-glow via-white to-violet-glow bg-clip-text text-transparent">
            Or subscribe if you live here.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Best conversion is a Party pass: pick guests + duration, get a secret{' '}
          <code className="text-cyan-glow">CCHAT</code> code, invite friends. Subscriptions are for
          weekly hosts. Cards stay with Stripe. We never see PAN or CVC.
        </p>

        {canceled && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Checkout cancelled. Nothing charged.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
            {error}
          </p>
        )}
        {sandbox && (
          <p className="mt-4 rounded-xl border border-cyan-glow/20 bg-cyan-glow/5 px-3 py-2 text-sm text-cyan-100">
            Test mode is on. Use card <strong>4242 4242 4242 4242</strong>. Add{' '}
            <code>STRIPE_SECRET_KEY=sk_test_…</code> from your Stripe Dashboard for hosted Checkout.
          </p>
        )}

        {mine && (
          <div className="mt-4 space-y-2 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">
            <div className="flex flex-wrap items-center gap-3">
              <Sparkles className="h-4 w-4" />
              {mine.plan === 'party' ? 'Party pass' : mine.plan === 'pro' ? 'Pro' : 'Plus'} active until{' '}
              {new Date(mine.expiresAt).toLocaleString()}
              {mine.seats ? ` · ${mine.seats} seats` : ''}
              {mine.roomCode ? ` · room ${mine.roomCode}` : ''}
            </div>
            {passCode() && (
              <div className="font-mono text-xs text-mint/80">
                Pass {passCode()} — keep this. It unlocks premium on any device.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {stripe && mine.kind !== 'party' && (
                <button className="underline" onClick={() => void portal()} disabled={busy === 'portal'}>
                  Manage in Stripe
                </button>
              )}
              {mine.kind === 'party' && (
                <>
                  <button className="underline" onClick={() => void checkout('party_addon', { extraSeats: 5 })}>
                    Add 5 invites ($10)
                  </button>
                  <button className="underline" onClick={() => void refund()} disabled={busy === 'refund'}>
                    Refund unused seats
                  </button>
                </>
              )}
              <button
                className="text-slate-400 underline"
                onClick={() => {
                  clearEntitlement();
                  setMine(null);
                }}
              >
                Remove from this device
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-2">
          <button className={`btn ${tab === 'party' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('party')}>
            Party pass
          </button>
          <button className={`btn ${tab === 'plus' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('plus')}>
            Plus / Pro
          </button>
        </div>

        {tab === 'party' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PARTY_PACKS.map((p) => (
              <article key={p.key} className="glass rounded-3xl p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-glow">{p.name}</div>
                <div className="mt-2 text-3xl font-semibold text-white">${p.amountUsd}</div>
                <p className="mt-2 text-sm text-slate-400">{p.blurb}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  <li>{p.seats} guests</li>
                  <li>{p.hours} hour hold</li>
                  <li>HD video · secret pass code</li>
                </ul>
                <button
                  className="btn btn-primary mt-4 w-full"
                  disabled={!enabled || busy === p.key}
                  onClick={() => void checkout(p.key)}
                >
                  {busy === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Buy {p.name}
                </button>
              </article>
            ))}
          </div>
        )}

        {tab === 'plus' && (
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Tier name="Free" price="$0" cadence="forever" features={[`${PLAN_LIMITS.free.maxParticipants} people`, '720p', '8 MB files']} />
            <Tier
              name="Plus"
              price="$8"
              cadence="/ month"
              highlight
              features={[`${PLAN_LIMITS.plus.maxParticipants} people`, '1080p', '32 MB files', '24h empty hold']}
              cta={
                <div className="flex flex-col gap-2">
                  <button className="btn btn-primary w-full" disabled={!enabled} onClick={() => void checkout('plus_monthly')}>
                    Plus monthly
                  </button>
                  <button className="btn btn-ghost w-full" disabled={!enabled} onClick={() => void checkout('plus_yearly')}>
                    $72 / year
                  </button>
                </div>
              }
            />
            <Tier
              name="Pro"
              price="$18"
              cadence="/ month"
              features={[`${PLAN_LIMITS.pro.maxParticipants} people`, '1080p 4 Mbps', '80 MB files', '7-day hold']}
              cta={
                <div className="flex flex-col gap-2">
                  <button className="btn btn-primary w-full" disabled={!enabled} onClick={() => void checkout('pro_monthly')}>
                    Pro monthly
                  </button>
                  <button className="btn btn-ghost w-full" disabled={!enabled} onClick={() => void checkout('pro_yearly')}>
                    $168 / year
                  </button>
                </div>
              }
            />
          </div>
        )}

        <section className="glass mt-10 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-white">
            <Ticket className="h-5 w-5 text-cyan-glow" />
            Redeem a pass on this device
          </div>
          <p className="mt-2 text-sm text-slate-400">
            No login. Paste <code>CCHAT-…</code> from your purchase receipt (or the success screen).
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="field font-mono tracking-[0.18em]"
              placeholder="CCHAT-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn btn-primary sm:w-40" disabled={busy === 'redeem'} onClick={() => void redeem()}>
              Unlock
            </button>
          </div>
        </section>

        <ul className="mt-8 grid gap-4 text-sm text-slate-400 sm:grid-cols-3">
          <li className="glass rounded-2xl p-4">
            <Shield className="mb-2 h-4 w-4 text-mint" />
            Stripe PCI. CipherChat stores a hash of your pass, never a card.
          </li>
          <li className="glass rounded-2xl p-4">
            <Check className="mb-2 h-4 w-4 text-cyan-glow" />
            Unused party seats can be refunded. Extra invites are $2 each.
          </li>
          <li className="glass rounded-2xl p-4">
            <Sparkles className="mb-2 h-4 w-4 text-violet-glow" />
            Repeat customers buy another Night pack. Power users convert to Plus.
          </li>
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}

function Tier({
  name,
  price,
  cadence,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <article className={`glass rounded-3xl p-6 ${highlight ? 'ring-1 ring-cyan-glow/30' : ''}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-glow">{name}</div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-4xl font-semibold text-white">{price}</span>
        <span className="pb-1 text-sm text-slate-500">{cadence}</span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-slate-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
            {f}
          </li>
        ))}
      </ul>
      {cta && <div className="mt-6">{cta}</div>}
    </article>
  );
}
