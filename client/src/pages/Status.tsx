import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useSession } from '../stores/session';

function Shell({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5">
      <Logo />
      <div className="glass mt-8 w-full max-w-lg rounded-3xl p-8 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-glow">{kicker}</div>
        <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-slate-400">{body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">{children}</div>
      </div>
    </div>
  );
}

export function LeftPage() {
  return (
    <Shell
      kicker="Session ended"
      title="You have left the room"
      body="Your display name and in-browser keys for this session are gone. If nobody remains, the room will be destroyed shortly."
    >
      <Link className="btn btn-primary" to="/">
        Return home
      </Link>
    </Shell>
  );
}

export function DestroyedPage() {
  const reason = useSession((s) => s.destroyedReason);
  const label =
    reason === 'inactivity'
      ? 'The room expired due to inactivity.'
      : reason === 'max-lifetime'
        ? 'The room reached its maximum lifetime.'
        : 'The last participant left.';
  return (
    <Shell
      kicker="Room destroyed"
      title="Temporary session data has been cleared"
      body={`${label} Messages, membership, and encryption keys held by this application have been discarded. External networks may still have technical logs.`}
    >
      <Link className="btn btn-primary" to="/">
        Create a new room
      </Link>
    </Shell>
  );
}

export function ErrorPage() {
  const nav = useNavigate();
  const msg = useSession((s) => s.errorMessage) ?? 'Unable to connect.';
  return (
    <Shell kicker="Something went wrong" title={msg} body="You can go back and try again. No account was created.">
      <button className="btn btn-primary" onClick={() => nav('/')}>
        Back to CipherRoom
      </button>
    </Shell>
  );
}
