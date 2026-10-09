import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { Logo } from './Logo';
import { COMPANY, COPYRIGHT_YEAR, DEVELOPER } from './SiteFooter';
import { hasLegalAccept, writeLegalAccept } from '../legal/accept';

const OPEN_PATHS = new Set(['/privacy', '/terms', '/about']);

export function AgeGate() {
  const loc = useLocation();
  const [ok, setOk] = useState(() => hasLegalAccept());
  const [age, setAge] = useState(false);
  const [risk, setRisk] = useState(false);

  if (ok) return null;
  if (OPEN_PATHS.has(loc.pathname)) return null;

  function accept() {
    if (!age || !risk) return;
    writeLegalAccept();
    setOk(true);
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#05070b]" role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-6">
        <Logo />
        <div className="mt-6 flex items-center gap-2 text-amber-200/90">
          <Scale className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Required legal disclosure</span>
        </div>
        <h1 id="legal-title" className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Age, risk, and liability waiver
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          You must read and accept this before using CipherChat. This is a clickwrap agreement, not legal advice.
        </p>

        <article className="glass mt-5 max-h-[min(52dvh,480px)] flex-1 overflow-y-auto rounded-2xl p-4 text-[13px] leading-6 text-slate-300 sm:p-5 sm:text-sm sm:leading-7">
          <p className="text-slate-500">Effective {COPYRIGHT_YEAR}. Binding on you, {DEVELOPER}, {COMPANY}, and their associated persons.</p>

          <h2 className="mt-4 font-semibold text-white">1. Parties protected</h2>
          <p>
            This disclosure and the Terms of Service protect {DEVELOPER} (developer and copyright owner); {COMPANY}{' '}
            (publisher); and each of their respective owners, members, managers, officers, directors, employees,
            contractors, agents, affiliates, successors, and assigns (together, the “Released Parties”).
          </p>

          <h2 className="mt-4 font-semibold text-white">2. You must be 18</h2>
          <p>
            CipherChat is for adults only. By continuing you represent that you are at least eighteen (18) years of age
            and have legal capacity to enter this agreement. We do not knowingly collect information from children. The
            Children&apos;s Online Privacy Protection Act, 15 U.S.C. §§ 6501–6506 (COPPA), and similar laws prohibit
            targeting children under 13; this product is not directed to anyone under 18. If you are under 18, you must
            not use CipherChat.
          </p>

          <h2 className="mt-4 font-semibold text-white">3. Prohibited and illegal use</h2>
          <p>
            You will not use CipherChat to violate any law. Child sexual abuse material is strictly prohibited (see 18
            U.S.C. §§ 2251–2260A and related statutes). You will not use the service for harassment, stalking, threats,
            fraud, trafficking, malware, unauthorized recording where consent is required, or any other unlawful act.
            The Released Parties do not monitor rooms and cannot retrieve vanished messages. You remain solely
            responsible for your conduct and for people you invite.
          </p>

          <h2 className="mt-4 font-semibold text-white">4. No monitoring; user content</h2>
          <p>
            CipherChat is a conduit for user-to-user communication. The Released Parties are not the publisher or
            speaker of user content. See the Communications Decency Act, 47 U.S.C. § 230. Messages are designed to
            exist only in memory for the session. The application does not keep chat history after a room is destroyed.
            Hosting providers, networks, STUN/TURN relays, and your own device may still generate technical logs outside
            this software.
          </p>

          <h2 className="mt-4 font-semibold text-white">5. Assumption of risk — use at your own risk</h2>
          <p>
            You understand that: (a) room codes and invite links are identifiers, not cryptographic secrets; (b) anyone
            with the code may join; (c) a participant you invited can screenshot, record, or leak content; (d) WebRTC
            may use STUN/TURN servers that see IP addresses; (e) encryption cannot protect a compromised device; (f)
            rooms may vanish, calls may drop, and files may fail. You assume all risk of use, misuse, interception,
            defamation, emotional distress, property damage, and loss of data or secrets.
          </p>

          <h2 className="mt-4 font-semibold text-white">6. Release of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, YOU HEREBY IRREVOCABLY RELEASE, WAIVE, AND DISCHARGE THE RELEASED
            PARTIES FROM ANY AND ALL CLAIMS, DEMANDS, DAMAGES, LOSSES, COSTS, AND CAUSES OF ACTION OF EVERY KIND,
            WHETHER KNOWN OR UNKNOWN, ARISING OUT OF OR RELATED TO YOUR ACCESS TO OR USE OF CIPHERCHAT, INCLUDING
            WITHOUT LIMITATION PERSONAL INJURY, DEFAMATION, PRIVACY VIOLATIONS, INTELLECTUAL-PROPERTY CLAIMS, LOST
            PROFITS, LOST DATA, FAILED CALLS, UNAUTHORIZED ACCESS RESULTING FROM A SHARED CODE, CONDUCT OF OTHER USERS,
            AND THIRD-PARTY NETWORKS. THIS RELEASE INCLUDES CLAIMS IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT
            LIABILITY, AND STATUTE, EXCEPT THAT NOTHING HEREIN EXCLUDES LIABILITY THAT CANNOT BE EXCLUDED UNDER
            APPLICABLE LAW (FOR EXAMPLE, LIABILITY FOR FRAUD OR WILLFUL MISCONDUCT WHERE SUCH A WAIVER IS VOID).
          </p>

          <h2 className="mt-4 font-semibold text-white">7. Indemnification</h2>
          <p>
            You will defend, indemnify, and hold harmless the Released Parties from any claim, loss, damage, judgment,
            or expense (including reasonable attorneys&apos; fees) arising from your use of CipherChat, your content,
            your invitees, or your violation of law or these terms.
          </p>

          <h2 className="mt-4 font-semibold text-white">8. No warranty</h2>
          <p>
            CIPHERCHAT IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AVAILABILITY, AND
            SECURITY. THE RELEASED PARTIES DO NOT WARRANT THAT ENCRYPTION IS UNBREAKABLE, THAT ROOMS WILL PERSIST, OR
            THAT THE SERVICE WILL BE ERROR-FREE.
          </p>

          <h2 className="mt-4 font-semibold text-white">9. Limitation of damages</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE RELEASED PARTIES SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS OR DATA, EVEN IF ADVISED OF THE
            POSSIBILITY. IF LIABILITY IS NEVERTHELESS IMPOSED, IT SHALL NOT EXCEED THE GREATER OF TEN U.S. DOLLARS
            (US$10) OR THE AMOUNT YOU PAID TO THE RELEASED PARTIES FOR CIPHERCHAT IN THE THREE MONTHS BEFORE THE CLAIM.
            SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE PLACES THE LIMITATION APPLIES TO THE FULLEST
            EXTENT PERMITTED.
          </p>

          <h2 className="mt-4 font-semibold text-white">10. Recording and consent</h2>
          <p>
            Some U.S. states require all-party consent to record audio or video. You are solely responsible for
            complying with recording, wiretap, and privacy laws that apply to you. CipherChat does not obtain consent
            on your behalf.
          </p>

          <h2 className="mt-4 font-semibold text-white">11. Electronic acceptance</h2>
          <p>
            By checking the boxes and tapping “I accept,” you intend to sign this agreement electronically under the
            Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 et seq. (E-SIGN), and similar
            state laws. A record of acceptance may be stored only on this device (localStorage / sessionStorage). The
            Released Parties do not receive your name, date of birth, or government ID from this screen.
          </p>

          <h2 className="mt-4 font-semibold text-white">12. Not legal advice; severability</h2>
          <p>
            This text is a product disclaimer, not legal advice and not a guarantee of immunity in every court. If a
            provision is unenforceable, the remainder stays in force. Continued use after an update to the Terms or
            Privacy Policy constitutes acceptance of the update. © {COPYRIGHT_YEAR} {DEVELOPER}. A product of {COMPANY}.
          </p>
        </article>

        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-cyan-400"
            checked={age}
            onChange={(e) => setAge(e.target.checked)}
          />
          <span>
            I am 18 years of age or older. I will not allow a minor to use CipherChat from this device.
          </span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-cyan-400"
            checked={risk}
            onChange={(e) => setRisk(e.target.checked)}
          />
          <span>
            I have read the disclosure. I use CipherChat at my own risk. I release {DEVELOPER}, {COMPANY}, and associated
            entities from liability for use, misuse, loss, and harm to the maximum extent the law allows.
          </span>
        </label>

        <button className="btn btn-primary mt-5 w-full" type="button" disabled={!age || !risk} onClick={accept}>
          I accept — enter CipherChat
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">
          If you do not accept, do not use the app.{' '}
          <Link className="text-cyan-glow hover:underline" to="/terms">
            Terms
          </Link>
          {' · '}
          <Link className="text-cyan-glow hover:underline" to="/privacy">
            Privacy
          </Link>
          {' · '}
          <Link className="text-cyan-glow hover:underline" to="/about">
            About
          </Link>
        </p>
      </div>
    </div>
  );
}
