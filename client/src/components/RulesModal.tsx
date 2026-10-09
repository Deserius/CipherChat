import { LOBBY_RULES } from '@shared/lobbies';
import { Link } from 'react-router-dom';

export function RulesModal({
  lounge,
  onAgree,
  onDisagree,
}: {
  lounge: string;
  onAgree: () => void;
  onDisagree: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="glass max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-left">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-glow">House rules</div>
        <h2 className="mt-2 text-2xl font-semibold text-white">{lounge}</h2>
        <p className="mt-2 text-sm text-slate-400">
          Common lounges are shared. Keep them clean. Private numeric rooms and paid Party rooms are
          the place for closed groups.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-200">
          {LOBBY_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          CipherChat does not watch rooms. You are responsible for your conduct.{' '}
          <Link className="text-cyan-glow" to="/terms">
            Terms
          </Link>
        </p>
        <div className="mt-6 flex gap-3">
          <button className="btn btn-ghost flex-1" type="button" onClick={onDisagree}>
            Disagree
          </button>
          <button className="btn btn-primary flex-1" type="button" onClick={onAgree}>
            I agree
          </button>
        </div>
      </div>
    </div>
  );
}
