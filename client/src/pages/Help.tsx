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
          <li>Enter a 4–10 digit code, create a random room, or tap a common lounge (Workout Kingz, Study Hive, …).</li>
          <li>Common lounges show house rules first. Agree or leave. No nudity, hate, or illegal content there.</li>
          <li>Allow the microphone when asked. Camera stays off until you tap Camera in the room. The app cannot click Allow for you.</li>
          <li>Share the QR, <code>/r/code</code>, or <code>/c/lounge-slug</code>. On the home screen, Scan QR reads a friend&apos;s code in-app.</li>
        </ol>

        <h2 className="mt-8 text-xl font-semibold text-white">When a lounge fills</h2>
        <p>
          Each lounge has a max (e.g. Workout Kingz = 8). The next person opens <em>Workout Kingz 2</em>.
          A few people in the first room are asked Stay or Go. New joiners land in the room with a free seat.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Secret messages</h2>
        <p>
          Tap the lock on a video tile or in People. Only you and that person decrypt it (ECDH). The lounge
          never sees the plaintext. The server only unicasts ciphertext.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Camera privacy</h2>
        <p>
          Joining does not turn your camera on. You start in chat. Tap Camera when you want to be seen. Mic is
          requested so you can talk; you can mute it any time.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Avatars</h2>
        <p>
          Pick a stylized mark or a tiny photo before you join (or in Settings). It is sent to the room for this
          session only — not a profile, not stored after the room dies.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Video and screen share on a phone</h2>
        <p>
          Open the Call tab. Faces tile in a grid that fills the screen. Tap Share: Android Chrome can
          share the screen or this tab; iPhone/iPad need Safari 17+ and “This Tab”. If share is blocked,
          you will see a real error — we cannot bypass the OS picker.
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
          Friends join the numeric room code for free until seats fill. The host can open Look to set a session
          title, background, font, and accent — shared with guests, not saved to a cloud. Buy extra invites later.
          Unused seats can be refunded (pro-rated) from Plus with the pass code.
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
