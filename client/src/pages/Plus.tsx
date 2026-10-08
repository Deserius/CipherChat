import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Crown, Loader2, Shield, Sparkles, Zap } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SiteFooter } from '../components/SiteFooter';
import { PLAN_LIMITS, type PlanId, type PriceKey } from '@shared/billing';
import { clearEntitlement, getEntitlement, entitlementToken } from '../services/entitlement';

interface PriceRow {
  key: PriceKey;
  plan: PlanId;
  interval: 'month' | 'year';
  amountUsd: number;
  label: string;
  configured: boolean;
}

export default function PlusPage() {
  const [params] = useSearchParams();
  const canceled = params.get('canceled') === '1';
  const [enabled, setEnabled] = useState(false);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [busy, setBusy] = useState<PriceKey | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(getEntitlement());

  useEffect(() => {
    void fetch('/api/billing/plans')
      .then((r) => r.json())
      .then((d) => {
        setEnabled(Boolean(d.enabled));
        setPrices(Array.isArray(d.prices) ? d.prices : []);
      })
      .catch(() => setError('Unable to load plans.'));
  }, []);

  async function checkout(priceKey: PriceKey) {
    setError(null);
    setBusy(priceKey);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Checkout could not start.');
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError('Stripe did not return a checkout URL.');
    } catch {
      setError('Network error starting Stripe Checkout.');
    } finally {
      setBusy(null);
    }
  }

  async function portal() {
    const token = entitlementToken();
    if (!token) return;
    setBusy('portal');
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cipher-Entitlement': token,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not open billing portal.');
        return;
      }
      if (data.url) window.location.assign(data.url);
    } catch {
      setError('Network error opening the Stripe portal.');
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
          <Link className="hover:text-white" to="/about">
            About
          </Link>
          <Link className="hover:text-white" to="/">
            Home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        <div className="badge mb-5">
          <Crown className="h-3.5 w-3.5" />
          CipherChat Plus · billed by Stripe
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Keep the rooms ephemeral.
          <span className="block bg-gradient-to-r from-cyan-glow via-white to-violet-glow bg-clip-text text-transparent">
            Pay for capacity, not identity.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          No CipherChat account. Stripe collects the card. We store a signed entitlement on this
          device only — never chat history, never a profile.
        </p>

        {canceled && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Checkout was cancelled. Nothing was charged.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
            {error}
          </p>
        )}
        {mine && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">
            <Sparkles className="h-4 w-4" />
            {mine.plan === 'pro' ? 'Pro' : 'Plus'} is active on this device until{' '}
            {new Date(mine.expiresAt).toLocaleDateString()}.
            <button className="underline" onClick={() => void portal()} disabled={busy === 'portal'}>
              Manage in Stripe
            </button>
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
        )}

        {!enabled && (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
            Stripe keys are not on this server yet. Checkout buttons will activate as soon as{' '}
            <code className="text-cyan-glow">STRIPE_SECRET_KEY</code> is set. Cards are never handled by CipherChat.
          </p>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <Tier
            name="Free"
            price="$0"
            cadence="forever"
            accent="border-white/10"
            features={[
              `${PLAN_LIMITS.free.maxParticipants} people per room`,
              '720p camera',
              '8 MB encrypted files',
              'Room dies when the last person leaves',
              'No account, no ads',
            ]}
          />
          <Tier
            name="Plus"
            price="$8"
            cadence="/ month"
            highlight
            accent="border-cyan-glow/40"
            features={[
              `${PLAN_LIMITS.plus.maxParticipants} people per room`,
              '1080p HD camera',
              '32 MB encrypted files',
              '24-hour empty-room hold (code stays reserved)',
              'Higher bitrate + 30 fps screen share',
            ]}
            cta={
              <PayButtons
                plan="plus"
                prices={prices}
                enabled={enabled}
                busy={busy}
                onPay={(k) => void checkout(k)}
              />
            }
          />
          <Tier
            name="Pro"
            price="$18"
            cadence="/ month"
            accent="border-violet-glow/40"
            features={[
              `${PLAN_LIMITS.pro.maxParticipants} people per room`,
              '1080p + 4 Mbps video cap',
              '80 MB encrypted files',
              '7-day empty-room hold',
              'Best path for larger groups',
            ]}
            cta={
              <PayButtons
                plan="pro"
                prices={prices}
                enabled={enabled}
                busy={busy}
                onPay={(k) => void checkout(k)}
              />
            }
          />
        </div>

        <ul className="mt-10 grid gap-4 text-sm text-slate-400 sm:grid-cols-3">
          <li className="glass rounded-2xl p-4">
            <Shield className="mb-2 h-4 w-4 text-mint" />
            Stripe Checkout is PCI-DSS. CipherChat never sees PAN, CVC, or bank details.
          </li>
          <li className="glass rounded-2xl p-4">
            <Zap className="mb-2 h-4 w-4 text-cyan-glow" />
            Entitlement is a signed token on this browser. Chat still lives only in RAM.
          </li>
          <li className="glass rounded-2xl p-4">
            <Check className="mb-2 h-4 w-4 text-violet-glow" />
            Cancel anytime in the Stripe customer portal. Access lasts through the paid period.
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
  accent,
}: {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta?: ReactNode;
  highlight?: boolean;
  accent: string;
}) {
  return (
    <article className={`glass rounded-3xl p-6 ${accent} ${highlight ? 'ring-1 ring-cyan-glow/30' : ''}`}>
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

function PayButtons({
  plan,
  prices,
  enabled,
  busy,
  onPay,
}: {
  plan: 'plus' | 'pro';
  prices: PriceRow[];
  enabled: boolean;
  busy: PriceKey | 'portal' | null;
  onPay: (key: PriceKey) => void;
}) {
  const month = prices.find((p) => p.plan === plan && p.interval === 'month');
  const year = prices.find((p) => p.plan === plan && p.interval === 'year');
  const monthKey = (month?.key ?? `${plan}_monthly`) as PriceKey;
  const yearKey = (year?.key ?? `${plan}_yearly`) as PriceKey;
  return (
    <div className="flex flex-col gap-2">
      <button
        className="btn btn-primary w-full"
        disabled={!enabled || busy === monthKey}
        onClick={() => onPay(monthKey)}
      >
        {busy === monthKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {plan === 'plus' ? 'Get Plus' : 'Get Pro'} · ${month?.amountUsd ?? (plan === 'plus' ? 8 : 18)}/mo
      </button>
      <button
        className="btn btn-ghost w-full"
        disabled={!enabled || busy === yearKey}
        onClick={() => onPay(yearKey)}
      >
        {busy === yearKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Yearly · ${year?.amountUsd ?? (plan === 'plus' ? 72 : 168)} (2 months free)
      </button>
    </div>
  );
}
