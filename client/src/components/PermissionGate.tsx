import { useEffect, useState } from 'react';
import { Camera, Mic, Shield, X } from 'lucide-react';
import { requestAv } from '../services/permissions';

export interface GateResult {
  stream: MediaStream | null;
  audio: boolean;
  video: boolean;
  notify: boolean;
  chatOnly: boolean;
}

export function PermissionGate({
  title = 'Camera and microphone',
  confirmLabel = 'Enter secure room',
  error,
  onConfirm,
  onCancel,
}: {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  error?: string;
  onConfirm: (r: GateResult) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(!error);
  const [localError, setLocalError] = useState(error);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    setLocalError(error);
    if (error) setBusy(false);
  }, [error]);

  async function retry() {
    setBusy(true);
    setLocalError(undefined);
    const g = await requestAv({ audio: true, video: true });
    setBusy(false);
    if (g.stream) {
      onConfirm({
        stream: g.stream,
        audio: g.audio,
        video: g.video,
        notify: false,
        chatOnly: false,
      });
      return;
    }
    setLocalError(g.error ?? 'Permission was not granted.');
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-title"
    >
      <div className="glass w-full max-w-md rounded-3xl p-6" style={{ maxHeight: '100dvh' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-cyan-glow">
              <Shield className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Device access</span>
            </div>
            <h2 id="perm-title" className="text-xl font-semibold text-white">
              {title}
            </h2>
          </div>
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          {busy
            ? 'Your browser is asking for camera and microphone. Tap Allow — you will enter automatically.'
            : 'Allow camera and microphone in the browser prompt. After you allow, the room opens on its own.'}
        </p>

        <div className="mt-4 flex h-28 flex-col items-center justify-center gap-3 rounded-2xl bg-black/40 text-sm text-slate-400">
          {busy ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-glow/20 border-t-cyan-glow" />
              Waiting for Allow…
            </>
          ) : (
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1">
                <Camera className="h-4 w-4 text-cyan-glow" /> Camera
              </span>
              <span className="inline-flex items-center gap-1">
                <Mic className="h-4 w-4 text-cyan-glow" /> Microphone
              </span>
            </div>
          )}
        </div>

        {localError && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" role="status">
            {localError}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {!busy && (
            <button className="btn btn-primary w-full" type="button" onClick={() => void retry()}>
              Allow camera & microphone
            </button>
          )}
          <button
            className="btn btn-ghost w-full"
            type="button"
            onClick={() =>
              onConfirm({ stream: null, audio: false, video: false, notify: false, chatOnly: true })
            }
          >
            Continue with chat only
          </button>
          <button className="btn btn-ghost w-full" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Browsers cannot skip their own Allow dialog. After you tap Allow once, this site remembers it.
        </p>
        <span className="sr-only">{confirmLabel}</span>
      </div>
    </div>
  );
}
