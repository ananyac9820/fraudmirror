import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store';
import { Container, Footer, Wordmark } from '../components/ui';

function LegalPage({ serif, sans, updated, children }: { serif: string; sans: string; updated: string; children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.token);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <Container className="flex h-16 items-center justify-between">
          <Link to={token ? '/dashboard' : '/login'}>
            <Wordmark />
          </Link>
          <Link to={token ? '/dashboard' : '/login'} className="link text-[13px]">
            {token ? 'Back to the console' : 'Back to sign in'}
          </Link>
        </Container>
      </header>
      <Container className="flex-1">
        <header className="border-b border-line pb-8 pt-14">
          <p className="eyebrow">Last updated {updated}</p>
          <h1 className="mt-4 text-[44px] font-light leading-[0.95] tracking-tight sm:text-[56px]">
            <span className="display block">{serif}</span>
            <span className="block">{sans}</span>
          </h1>
        </header>
        <article className="max-w-[68ch] py-10 text-[15px] leading-relaxed text-muted [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-[17px] [&_h2]:font-normal [&_h2]:text-ink [&_li]:mt-2 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>
      </Container>
      <Footer />
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage serif="Privacy" sans="policy" updated="28 September 2026">
      <p>
        FraudMirror is a student project built for a Web Technologies course. It demonstrates fraud detection on data that its own simulator
        generates. This policy explains what the application stores and why.
      </p>
      <h2>Transaction data</h2>
      <p>
        Every transaction, account number, device, merchant and city shown in FraudMirror is synthetic. The application does not collect, receive
        or process real card, bank, UPI or personal financial data. Please do not enter real financial information anywhere in the application.
      </p>
      <h2>Files you upload</h2>
      <p>
        The Analyze page accepts a CSV file of transactions. Its rows and the detector’s output are stored on the server so they can be reopened
        later, and are visible to anyone signed in to the same deployment. Upload synthetic or anonymised data only. Never upload real customer,
        card or bank records.
      </p>
      <h2>Account information</h2>
      <ul>
        <li>The platform uses three pre-created demo accounts. No sign-up is offered and no other user accounts are created.</li>
        <li>Passwords are stored only as bcrypt hashes on the server.</li>
        <li>Analyst case notes and review decisions are stored with the name of the demo account that made them.</li>
      </ul>
      <h2>Stored in your browser</h2>
      <ul>
        <li>After sign-in, a session token (JWT) and the demo account’s name and role are kept in local storage so you stay signed in.</li>
        <li>Your Defender or Attacker view preference is kept in local storage.</li>
        <li>Signing out removes the token and account details. The application sets no cookies and uses no analytics or advertising trackers.</li>
      </ul>
      <h2>Public demo copy</h2>
      <p>
        The copy published on GitHub Pages runs entirely in your browser. Its simulated data lives in memory and disappears when you close or reload
        the tab. Nothing is sent to a FraudMirror server.
      </p>
      <h2>Third parties</h2>
      <p>
        Fonts are loaded from Google Fonts, which receives your IP address when the page loads. The public demo copy is hosted by GitHub Pages, which
        may keep standard server logs under GitHub’s own privacy statement.
      </p>
      <h2>Retention</h2>
      <p>
        When run locally without a configured database, all data is held in memory and deleted whenever the server restarts. If an operator connects
        a persistent MongoDB database, stream data is removed automatically after 24 hours and uploaded analyses stay until the operator removes them.
      </p>
      <h2>Contact</h2>
      <p>Questions about this project can be raised through the repository’s issue tracker on GitHub.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage serif="Terms" sans="of service" updated="28 September 2026">
      <p>By using FraudMirror you agree to the terms below. If you do not agree, please do not use the application.</p>
      <h2>Purpose</h2>
      <p>
        FraudMirror is an educational demonstration. It is not a financial service, it does not process real payments, and its fraud scores are not
        advice about any real transaction, person or business.
      </p>
      <h2>Simulated attacks</h2>
      <p>
        The Attack Lab produces synthetic transaction patterns inside the simulator only. It does not interact with any external system.
        You may not use this project, or ideas taken from it, to attempt fraud or to test systems you are not authorised to test.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not enter or upload real card numbers, bank details, passwords from other services, or personal data.</li>
        <li>Do not attempt to disrupt, overload or gain unauthorised access to any deployment of the application.</li>
        <li>The demo accounts are shared. Anything you type into a case note may be visible to other people using the same deployment.</li>
      </ul>
      <h2>No warranty</h2>
      <p>
        The application is provided as is, without any warranty. Detection results are produced by a simple rule-based model and are deliberately
        imperfect. The authors are not liable for any loss arising from its use.
      </p>
      <h2>Changes</h2>
      <p>These terms may change as the project develops. The date at the top of this page shows when they last changed.</p>
    </LegalPage>
  );
}
