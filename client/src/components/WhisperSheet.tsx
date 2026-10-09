import { FormEvent, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { getController } from '../services/roomController';

export function WhisperSheet({
  toId,
  toName,
  onClose,
}: {
  toId: string;
  toName: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await getController().sendWhisper(toId, text);
      setText('');
      onClose();
    } catch {
      setErr('Secret not sent — wait for encryption keys, then try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true">
      <form className="glass w-full max-w-md rounded-3xl p-5" onSubmit={(e) => void send(e)}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Lock className="h-4 w-4 text-cyan-glow" />
            Secret to {toName}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Only you and {toName} see this. The lounge does not. The server relays ciphertext.
        </p>
        {err && <p className="mb-2 text-sm text-rose-200">{err}</p>}
        <textarea
          className="field min-h-24 resize-none"
          autoFocus
          maxLength={1000}
          placeholder="Private note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary mt-3 w-full" type="submit" disabled={busy || !text.trim()}>
          Send secret
        </button>
      </form>
    </div>
  );
}
