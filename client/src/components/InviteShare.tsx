import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Link2, Mail, MessageCircle, QrCode, Share2, X, MessageSquare } from 'lucide-react';
import { inviteUrl } from '../services/roomController';

export function InviteShare({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const url = inviteUrl(code);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const message = `Join my CipherRoom. One tap, enter a name, allow camera/mic: ${url}`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const mod = await import('qrcode');
        const QR = (mod as { default?: typeof mod }).default ?? mod;
        const data = await QR.toDataURL(url, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#032026', light: '#e7fbff' },
        });
        if (alive) setQr(data);
      } catch {
        if (alive) setQr(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  async function copy(kind: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(kind === 'link' ? url : code);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CipherRoom invite', text: message, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy('link');
  }

  const sms = `sms:?&body=${encodeURIComponent(message)}`;
  const mail = `mailto:?subject=${encodeURIComponent('CipherRoom invite')}&body=${encodeURIComponent(message)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Join my CipherRoom')}`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div className="glass flex w-full max-w-sm flex-col overflow-hidden rounded-3xl" style={{ maxHeight: '100dvh' }}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-glow">Invite people</div>
            <h2 id="invite-title" className="mt-1 text-xl font-semibold text-white">
              Room {code}
            </h2>
          </div>
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            onClick={onClose}
            aria-label="Close invite and go to chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto mt-3 w-36 shrink-0 rounded-2xl bg-[#e7fbff] p-2 sm:w-44">
          {qr ? (
            <img src={qr} alt={`QR code for room ${code}`} className="h-full w-full" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-[#032026]">
              <QrCode className="mr-1 h-4 w-4" /> QR…
            </div>
          )}
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-500">Scan to join · no account</p>

        <div className="mx-5 mt-3 truncate rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] text-cyan-100">
          {url}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 px-5">
          <button className="btn btn-ghost !min-h-11 !py-2 text-xs" onClick={() => void copy('link')}>
            {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
          <button className="btn btn-ghost !min-h-11 !py-2 text-xs" onClick={() => void copy('code')}>
            {copied === 'code' ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>

        <div className="mt-2 flex justify-center gap-2 px-5 pb-1">
          <IconLink onClick={() => void nativeShare()} label="Share">
            <Share2 className="h-4 w-4" />
          </IconLink>
          <IconLink href={sms} label="SMS">
            <MessageCircle className="h-4 w-4" />
          </IconLink>
          <IconLink href={mail} label="Email">
            <Mail className="h-4 w-4" />
          </IconLink>
          <IconLink href={wa} label="WhatsApp">
            WA
          </IconLink>
          <IconLink href={tg} label="Telegram">
            TG
          </IconLink>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 p-4">
          <button className="btn btn-primary w-full" onClick={onClose}>
            <MessageSquare className="h-4 w-4" />
            Go to chat room
          </button>
          <button className="btn btn-ghost w-full" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function IconLink({
  href,
  onClick,
  label,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: ReactNode;
}) {
  const cls =
    'flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[10px] font-semibold text-slate-200 hover:bg-white/15';
  if (href) {
    return (
      <a className={cls} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} type="button" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}
