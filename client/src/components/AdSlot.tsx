import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/**
 * Ads never load inside encrypted rooms.
 * Default is a first-party house ad (Plus / Party) — highest conversion, no tracker.
 * Optional EthicalAds / AdSense only on marketing pages when env is configured.
 */
export function AdSlot({ placement }: { placement: 'landing' | 'plus' | 'help' }) {
  const [ads, setAds] = useState<{ house: boolean; adsense: boolean; ethicalads: boolean }>({
    house: true,
    adsense: false,
    ethicalads: false,
  });

  useEffect(() => {
    void fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ads) setAds(d.ads);
      })
      .catch(() => undefined);
  }, []);

  if (placement === 'plus') return null;

  return (
    <aside className="glass mx-auto mt-8 max-w-6xl overflow-hidden rounded-2xl p-4 sm:p-5" aria-label="Sponsor">
      {ads.house && (
        <Link to="/plus" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-glow">
              <Sparkles className="h-3.5 w-3.5" />
              Free tier
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Hosting is paid by Party passes and Plus. Throw a private night for a few dollars — no account.
            </p>
          </div>
          <span className="btn btn-primary mt-2 shrink-0 sm:mt-0">Party from $6</span>
        </Link>
      )}
      {ads.ethicalads && (
        <div className="ethicalads mt-3 min-h-[90px] text-xs text-slate-500" data-ea-publisher="cipherchat" data-ea-type="image" />
      )}
      {ads.adsense && (
        <p className="mt-2 text-[11px] text-slate-600">
          AdSense is configured on this host. Ads never appear inside a room or on ciphertext.
        </p>
      )}
    </aside>
  );
}
