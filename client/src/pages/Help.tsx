import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SiteFooter, DEVELOPER, COMPANY } from '../components/SiteFooter';
import { AdSlot } from '../components/AdSlot';

export default function HelpPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo compact />
        </Link>
        <Link className="text-sm text-slate-400 hover:text-white" to="/">
          Home
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-5 pb-16 text-[15px] leading-7 text-slate-300">
        <h1 className="text-3xl font-semibold text-white">Help</h1>
        <p className="mt-3 text-slate-400">
          CipherChat is ephemeral encrypted chat and video. No account. Rooms die when everyone leaves
          unless you bought a Party pass or Plus hold.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Join a room</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Pick a display name (examples cycle in the box).</li>
          <li>Enter a 4–10 digit code or create a random room.</li>
          <li>Allow camera and microphone when asked. The app cannot click Allow for you.</li>
          <li>Share the QR or <code>/r/code</code> link.</li>
        </ol>

        <h2 className="mt-8 text-xl font-semibold text-white">Video on a phone</h2>
        <p>
          Open the Call tab. Faces tile in a grid that fills the screen — 2, 4, 6, 9 people without
          scrolling. Tap a tile to spotlight it. If someone is missing, they should tap Camera; you
          should not need to leave the room.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Anonymous premium (pass codes)</h2>
        <p>
          Paying does not create a CipherChat login. After payment you get a one-time pass{' '}
          <code className="text-cyan-glow">CCHAT-XXXX-XXXX-XXXX</code>. Save it. On this device it is
          stored locally. On a new device, open Plus → Redeem and type the code. We store only a hash
          of the code, never your name or card.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Party rooms</h2>
        <p>
          One-time packs (Spark / House / Night / Weekend) reserve a room for N guests and a duration.
          Friends join the numeric room code for free until seats fill. Buy extra invites later. Unused
          seats can be refunded (pro-rated) from Plus with the pass code.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Stripe test cards</h2>
        <p>
          Without <code>STRIPE_SECRET_KEY</code>, checkout uses Stripe&apos;s documented test PANs
          (4242… succeeds). With <code>sk_test_…</code> from your Stripe Dashboard, hosted Checkout
          runs in test mode. Live keys (<code>sk_live_</code>) take real money.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Ads</h2>
        <p>
          Free landing pages may show a first-party Plus/Party house ad. Third-party networks
          (EthicalAds, AdSense) load only if the operator sets env vars, and never inside a room.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Safety</h2>
        <p>
          Room codes are identifiers, not secrets. {DEVELOPER} and {COMPANY} are not legally responsible
          for how CipherChat is used. See{' '}
          <Link className="text-cyan-glow" to="/privacy">
            Privacy
          </Link>{' '}
          and{' '}
          <Link className="text-cyan-glow" to="/terms">
            Terms
          </Link>
          .
        </p>
      </article>
      <AdSlot placement="help" />
      <SiteFooter />
    </div>
  );
}
