import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — LUDINO",
  description: "How LUDINO handles your data. Replace with legal review before production.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <div className="game-card space-y-4 p-6 text-sm leading-relaxed text-white/80">
          <p className="text-white/60">
            <strong className="text-[var(--danger)]">Draft —</strong> This is a
            placeholder for App Store / Play and web compliance. Have it
            reviewed by counsel and update with your entity name, data
            practices, and jurisdictions.
          </p>
          <p>
            <strong>1. Overview</strong>
            <br />
            LUDINO (“we”, “our”) operates this website and game services. This
            policy describes how we collect, use, and share information when you
            use our product.
          </p>
          <p>
            <strong>2. Information we may collect</strong>
            <br />
            Account details (such as email or username), gameplay and match
            data, device and technical logs, and optional wallet-related
            metadata when you use blockchain features. We do not store your
            private keys or seed phrases.
          </p>
          <p>
            <strong>3. How we use data</strong>
            <br />
            To run the game, prevent abuse, improve reliability, and comply
            with law.
          </p>
          <p>
            <strong>4. Contact</strong>
            <br />
            Questions:{" "}
            <a className="text-[var(--gold)] hover:underline" href={`mailto:${support}`}>
              {support}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
