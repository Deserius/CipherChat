import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SiteFooter, DEVELOPER, COMPANY, COPYRIGHT_YEAR } from '../components/SiteFooter';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo compact />
        </Link>
        <div className="flex gap-4 text-sm text-slate-400">
          <Link className="hover:text-white" to="/about">
            About
          </Link>
          <Link className="hover:text-white" to="/">
            Home
          </Link>
        </div>
      </header>
      <article className="prose-invert mx-auto max-w-3xl px-5 pb-20">
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-300">{children}</div>
      </article>
      <SiteFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="text-slate-500">Last updated: 7 September 2026. This is an informational policy for the CipherRoom software, not legal advice.</p>
      <h2 className="pt-4 text-xl font-semibold text-white">What CipherRoom is</h2>
      <p>
        CipherRoom is a privacy-first communication application. You can join a temporary room with a display name
        and a short numeric room code. No account, email address, password, permanent username, profile, phone number,
        or social login is required for the core experience.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">What we intentionally do not retain</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Permanent user accounts or profiles</li>
        <li>Chat history after a room is destroyed</li>
        <li>Uploaded files after a room is destroyed</li>
        <li>Application-level advertising profiles</li>
        <li>Analytics pixels, fingerprinting scripts, or social trackers (none ship by default)</li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold text-white">What exists while a room is active</h2>
      <p>
        While you are in a room, the server holds ephemeral in-memory state: the room code, a random participant id,
        your display name, a short-lived session token, and WebRTC signaling data. Messages are relayed as ciphertext.
        The server is not given the room encryption key. Media flows peer-to-peer (or via a TURN relay you configure)
        using WebRTC&apos;s DTLS/SRTP.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">When a room is destroyed</h2>
      <p>
        After the last participant leaves (plus a short reconnect grace period), CipherRoom marks the room inactive,
        stops message processing, deletes in-memory messages and membership, discards session tokens, and drops
        encryption keys held in the browser. Temporary files are never written to durable storage by the application.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">What we cannot honestly promise</h2>
      <p>
        We do not claim that “nothing can ever be logged.” Hosting providers, reverse proxies, CDNs, operating systems,
        STUN/TURN servers, and networks may generate technical logs (for example IP addresses, TLS connection metadata,
        or request paths) outside this application’s control. STUN and TURN servers necessarily observe IP addresses in
        order to establish WebRTC connectivity. If you configure Twilio, that provider processes phone numbers and SMS
        content according to its own policies.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Cookies and local data</h2>
      <p>
        CipherRoom does not use advertising cookies. A session token may be kept in <code>sessionStorage</code> so a
        refresh can reconnect during the grace period. The Progressive Web App caches only static application assets,
        never messages or room content.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Security practices</h2>
      <p>
        Transport uses HTTPS/WSS where the host provides TLS. Messaging uses AES-256-GCM with ECDH P-256 key
        distribution in the browser. Signaling messages are authenticated with a per-session token. Rate limits and
        input validation reduce abuse. See <code>docs/SECURITY.md</code> and <code>docs/THREAT_MODEL.md</code> in the
        source repository.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Your choices</h2>
      <p>
        You may leave a room at any time. You choose the display name others see. You should only share a room code
        with people you intend to meet — room codes are identifiers, not cryptographic secrets.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Contact</h2>
      <p>
        Operators who deploy this software should replace this paragraph with their contact address. The default
        project contact placeholder is: privacy@example.invalid
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p className="text-slate-500">Last updated: 7 September 2026. Informational terms for the CipherRoom software.</p>
      <h2 className="pt-4 text-xl font-semibold text-white">Acceptable use</h2>
      <p>
        You may use CipherRoom for lawful, consensual communication. You must not use it to harass, abuse, exploit
        minors, distribute malware, conduct fraud, or violate applicable law.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Illegal content</h2>
      <p>
        Illegal content is prohibited. Operators may rate-limit, block, or terminate rooms that appear to be used for
        abuse, without reading message plaintext (which the server does not hold).
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">No accounts, no warranty of availability</h2>
      <p>
        The service is provided as-is. Rooms are temporary and may be destroyed because participants left, the process
        restarted, an inactivity timer fired, or infrastructure failed. Do not use CipherRoom as a system of record.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Security limitations</h2>
      <p>
        Encryption cannot protect a compromised device, a malicious participant you invited, or a guessed room code
        that you treated as a secret. WebRTC still requires STUN/TURN. See the threat model in the documentation.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Third-party services</h2>
      <p>
        Optional Twilio, TURN, Redis, or hosting providers are operated by third parties under their own terms. The
        core web messaging and WebRTC features work without Twilio.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Your responsibilities</h2>
      <p>
        You are responsible for the people you invite, the files you share, and for verifying you are in the room you
        intended. Share invite links through a channel you trust.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">No responsibility for user conduct</h2>
      <p>
        {DEVELOPER} and {COMPANY} do not monitor rooms and accept no legal responsibility for how
        CipherRoom is used. You are solely responsible for your communications, invitees, files, and
        compliance with applicable law. If you disagree, do not use the software.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-white">Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {DEVELOPER} and {COMPANY} are not liable for lost
        messages, failed calls, unauthorized access resulting from shared room codes, user-generated
        content, misuse by any party, or any damages arising from use or inability to use this
        software. CipherRoom is provided as-is, without warranties of any kind. © {COPYRIGHT_YEAR}{' '}
        {DEVELOPER}. See also the{' '}
        <Link className="text-cyan-glow hover:underline" to="/about">
          About &amp; developer
        </Link>{' '}
        page.
      </p>
    </LegalShell>
  );
}
