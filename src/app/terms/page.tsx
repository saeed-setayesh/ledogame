import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — LUDINO",
  description: "Terms for using LUDINO. Replace with legal review before production.",
};

export default function TermsPage() {
  const support =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";

  return (
    <div className="game-bg min-h-dvh px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/landing"
          className="mb-6 inline-block text-sm text-[var(--gold)] hover:underline"
        >
          ← Back to home
        </Link>
        <h1 className="mb-6 font-[family-name:var(--font-heading)] text-3xl text-[var(--gold)]">
          Terms of Service
        </h1>
        <div className="game-card space-y-4 p-6 text-sm leading-relaxed text-white/80">
          <p className="text-white/60">
            <strong className="text-[var(--danger)]">Draft —</strong> Placeholder
            only. Replace with lawyer-approved terms including age limits,
            jurisdiction, dispute resolution, and rules for paid play.
          </p>
          <p>
            <strong>1. Acceptance</strong>
            <br />
            By accessing LUDINO you agree to these terms and our Privacy
            Policy.
          </p>
          <p>
            <strong>2. The service</strong>
            <br />
            We provide an online Ludo game, lobby, and related features. We may
            change or discontinue features with reasonable notice where
            possible.
          </p>
          <p>
            <strong>3. Conduct</strong>
            <br />
            You agree not to cheat, exploit bugs for unfair advantage, harass
            other players, or misuse the platform.
          </p>
          <p>
            <strong>4. Optional paid play</strong>
            <br />
            Where entry fees or wallets are offered, additional rules and
            regional restrictions may apply. You are responsible for compliance
            with local laws.
          </p>
          <p>
            <strong>5. Contact</strong>
            <br />
            <a className="text-[var(--gold)] hover:underline" href={`mailto:${support}`}>
              {support}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
