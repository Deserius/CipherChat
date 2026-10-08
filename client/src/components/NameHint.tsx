import { useEffect, useState } from 'react';

const HINTS = [
  'Ghost Pixel',
  'Quiet Cipher',
  'Null Signal',
  'Shadow Bit',
  'Discreet Ember',
  'Silent Key',
  'Veil Runner',
  'Night Hash',
  'Whisper Node',
  'Cipher Fox',
  'Hollow Echo',
  'Ion Ghost',
];

export function NameHint() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * HINTS.length));
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'type' | 'hold' | 'erase'>('type');

  useEffect(() => {
    const full = HINTS[index] ?? HINTS[0]!;
    let timer: number;
    if (phase === 'type') {
      if (text.length < full.length) {
        timer = window.setTimeout(() => setText(full.slice(0, text.length + 1)), 70);
      } else {
        timer = window.setTimeout(() => setPhase('hold'), 1400);
      }
    } else if (phase === 'hold') {
      timer = window.setTimeout(() => setPhase('erase'), 900);
    } else {
      if (text.length > 0) {
        timer = window.setTimeout(() => setText(text.slice(0, -1)), 36);
      } else {
        setIndex((i) => (i + 1) % HINTS.length);
        setPhase('type');
      }
    }
    return () => window.clearTimeout(timer);
  }, [text, phase, index]);

  return (
    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-medium text-slate-500">
      {text}
      <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-cyan-glow/70" aria-hidden />
    </span>
  );
}
