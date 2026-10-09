import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Maximize2 } from 'lucide-react';
import type { PeerMedia } from '../webrtc/callManager';
import { AvatarMark } from './AvatarMark';

export function videoGridTemplate(count: number, narrow: boolean): { cols: number; rows: number } {
  const n = Math.max(1, count);
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return narrow ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return narrow ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return narrow ? { cols: 3, rows: 4 } : { cols: 4, rows: 3 };
  if (n <= 16) return { cols: 4, rows: 4 };
  const cols = Math.min(5, Math.ceil(Math.sqrt(n)));
  return { cols, rows: Math.ceil(n / cols) };
}

export function VideoGrid({
  selfId,
  selfName,
  localStream,
  cameraOn,
  peers,
  participants,
  quality,
  spotlight,
  onSpotlight,
  onWhisper,
}: {
  selfId: string;
  selfName: string;
  localStream: MediaStream | null;
  cameraOn: boolean;
  peers: PeerMedia[];
  participants: { id: string; name: string; camera: boolean; microphone: boolean; avatar?: string }[];
  quality: Record<string, number>;
  spotlight: string | null;
  onSpotlight: (id: string | null) => void;
  onWhisper?: (id: string) => void;
}) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const tiles = useMemo(
    () => [
      {
        id: selfId,
        name: selfName,
        stream: localStream,
        self: true,
        camera: cameraOn,
        avatar: participants.find((x) => x.id === selfId)?.avatar,
      },
      ...peers.map((p) => ({
        id: p.id,
        name: participants.find((x) => x.id === p.id)?.name ?? 'Guest',
        stream: p.stream,
        self: false,
        camera: p.videoEnabled,
        avatar: participants.find((x) => x.id === p.id)?.avatar,
      })),
    ],
    [selfId, selfName, localStream, cameraOn, peers, participants],
  );
  const shown = spotlight ? tiles.filter((t) => t.id === spotlight) : tiles;
  const { cols, rows } = videoGridTemplate(shown.length, narrow);

  return (
    <div
      className="video-grid-fit"
      style={{ ['--cols' as string]: cols, ['--rows' as string]: rows }}
    >
      {shown.map((t) => (
        <div key={t.id} className="video-tile group">
          {t.stream && t.stream.getVideoTracks().some((tr) => tr.readyState !== 'ended') ? (
            <VideoEl
              stream={t.stream}
              muted={t.self}
              trackKey={t.stream
                .getTracks()
                .map((tr) => tr.id + tr.readyState)
                .join(',')}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <AvatarMark id={t.id} name={t.name} avatar={t.avatar} size={80} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
            <span className="truncate">
              {t.name}
              {t.self ? ' (you)' : ''}
            </span>
            <span className="flex items-center gap-2">
              <QualityBars n={quality[t.id] ?? (t.self ? 3 : 2)} />
              {!t.self && onWhisper && (
                <button
                  className="opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Secret message ${t.name}`}
                  onClick={() => onWhisper(t.id)}
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
              <button
                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Spotlight"
                onClick={() => onSpotlight(spotlight === t.id ? null : t.id)}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoEl({ stream, muted, trackKey }: { stream: MediaStream; muted?: boolean; trackKey?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    const play = () => {
      el.play().catch(() => undefined);
    };
    const refresh = () => {
      el.srcObject = stream;
      play();
    };
    el.addEventListener('loadedmetadata', play);
    stream.addEventListener('addtrack', refresh);
    stream.addEventListener('removetrack', refresh);
    play();
    return () => {
      el.removeEventListener('loadedmetadata', play);
      stream.removeEventListener('addtrack', refresh);
      stream.removeEventListener('removetrack', refresh);
    };
  }, [stream, trackKey]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

function QualityBars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={`Connection quality ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= n ? 'bg-mint' : 'bg-white/20'}`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </span>
  );
}

export { QualityBars };
