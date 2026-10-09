import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { parseCipherInvite } from '@shared/invite';

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> };

function makeDetector(): Detector | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export function QrScan({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (hit: { room?: string; lobby?: string }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [live, setLive] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: number | null = null;
    const detector = makeDetector();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera. Paste an invite link instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => undefined);
        }
        setLive(true);
        if (!detector) {
          setError('Live QR decode needs Chrome, Edge, or Safari 17+. You can still paste a link or type a code.');
          return;
        }
        const tick = async () => {
          if (stop) return;
          const el = videoRef.current;
          if (el && el.readyState >= 2) {
            try {
              const codes = await detector.detect(el);
              const raw = codes[0]?.rawValue;
              if (raw) {
                const hit = parseCipherInvite(raw);
                if (hit) {
                  onResultRef.current(hit);
                  return;
                }
              }
            } catch {
              /* keep scanning */
            }
          }
          timer = window.setTimeout(() => void tick(), 280);
        };
        void tick();
      } catch {
        setError('Camera was blocked. Paste the invite link or type the room code.');
      }
    }

    void start();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function submitPaste() {
    const hit = parseCipherInvite(paste);
    if (hit) onResultRef.current(hit);
    else setError('That does not look like a CipherChat invite or room code.');
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <div className="glass w-full max-w-md overflow-hidden rounded-3xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-glow">In-app scanner</div>
            <h2 id="scan-title" className="mt-1 text-xl font-semibold text-white">
              Scan a CipherChat QR
            </h2>
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" onClick={onClose} aria-label="Close scanner">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mx-5 mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
          {!live && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              <Camera className="h-8 w-8" />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-3 px-5 text-xs text-amber-100" role="status">
            {error}
          </p>
        )}
        <div className="p-5">
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Or paste link / code</label>
          <div className="flex gap-2">
            <input
              className="field flex-1 font-mono"
              placeholder="https://…/r/482917 or 482917"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitPaste();
                }
              }}
            />
            <button className="btn btn-primary !px-4" type="button" onClick={submitPaste}>
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
