import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Dices,
  Users,
  Wallet,
  Shield,
  Smartphone,
  Globe,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LUDINO — Online Ludo with USDT stakes",
  description:
    "Play classic Ludo online with friends, ranked matches, and optional USDT (BEP-20) wallet play. Web and PWA — companion native apps coming soon.",
  openGraph: {
    title: "LUDINO — Online Ludo",
    description:
      "Multiplayer Ludo with lobby, video-friendly sessions, and fair play tooling.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 h-[min(80vh,720px)] w-[min(120vw,960px)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(212,56,44,0.18),transparent_65%)]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,215,0,0.08),transparent_70%)]" />
      </div>

      <header className="relative z-10 border-b border-[var(--gold-border)]/30 bg-[var(--card)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
          <Link
            href="/landing"
            className="flex shrink-0 items-center justify-center sm:justify-start"
          >
            <Image
              src="/game/logo.png"
              alt="LUDINO"
              width={200}
              height={72}
              className="h-10 w-auto object-contain sm:h-11"
              priority
              unoptimized
            />
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:justify-end sm:gap-x-2">
            <Link
              href="/landing#features"
              className="rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white sm:py-2"
            >
              Features
            </Link>
            <Link
              href="/landing#product"
              className="rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white sm:py-2"
            >
              Product
            </Link>
            <Link
              href="/auth/signin"
              className="rounded-xl border border-[var(--gold-border)] bg-[var(--primary)]/90 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--primary-dark)] sm:ml-1"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pb-28 sm:pt-12 md:pt-16">
        <div className="flex flex-col gap-16 md:gap-20 lg:gap-24">
          <section className="text-center" aria-labelledby="landing-hero">
            <h1 id="landing-hero" className="sr-only">
              LUDINO — classic Ludo online
            </h1>
            <div className="mb-8 flex justify-center sm:mb-10">
              <Image
                src="/game/logo.png"
                alt=""
                width={560}
                height={200}
                className="h-28 w-auto max-w-[min(100%,420px)] object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:h-36 md:h-44"
                priority
                unoptimized
              />
            </div>
            <p className="mx-auto mb-4 max-w-2xl px-1 font-[family-name:var(--font-heading)] text-lg leading-snug tracking-wide text-[var(--gold)] sm:mb-5 sm:text-xl">
              Classic Ludo — online, with friends
            </p>
            <p className="mx-auto mb-10 max-w-2xl px-1 text-sm leading-relaxed text-white/70 sm:mb-12 sm:text-base">
              Matchmaking lobby, real-time multiplayer, optional USDT (BEP-20)
              wallet flows for entry fees and payouts, and a polished board made
              for long sessions on phone and desktop. Use this site as the public
              home for App Store / Play review and marketing.
            </p>
            <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-4 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
              <Link
                href="/auth/signin"
                className="game-play-btn inline-flex min-h-[3.25rem] items-center justify-center gap-2 px-8 py-3.5 text-base font-bold sm:min-h-0 sm:px-10 sm:py-4"
              >
                <Dices className="h-6 w-6 shrink-0" />
                Play in browser
              </Link>
              <a
                href="#download"
                className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-base font-semibold text-white/90 backdrop-blur-sm hover:bg-white/10 sm:min-h-0 sm:py-4"
              >
                <Smartphone className="h-5 w-5 shrink-0" />
                Native apps
              </a>
            </div>
          </section>

          <section
            id="features"
            className="scroll-mt-[5.5rem]"
          >
            <h2 className="mb-6 text-center text-2xl font-bold text-[var(--gold)] sm:mb-8 sm:text-3xl">
              What you get
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {[
                {
                  icon: <Dices className="h-6 w-6 text-[var(--gold)]" />,
                  title: "Real-time Ludo",
                  body: "Live game state, dice, and piece movement with a tactile board aligned to production art.",
                },
                {
                  icon: <Users className="h-6 w-6 text-info" />,
                  title: "Lobby & social",
                  body: "Create or join tables, see players, and optional in-game presence for longer sessions.",
                },
                {
                  icon: <Wallet className="h-6 w-6 text-success" />,
                  title: "Wallet-ready",
                  body: "USDT on BEP-20 patterns for deposits, balance display, and withdrawals when enabled.",
                },
                {
                  icon: <Shield className="h-6 w-6 text-danger" />,
                  title: "Fair play",
                  body: "Server-authoritative rules and turn flows designed for competitive and casual modes.",
                },
                {
                  icon: <Globe className="h-6 w-6 text-gold-dim" />,
                  title: "PWA & web",
                  body: "Installable progressive web app; same product URL reviewers can open in Safari or Chrome.",
                },
              {
                icon: <Smartphone className="h-6 w-6 text-[var(--gold)]" />,
                title: "Capacitor native",
                body: "One codebase for App Store & Google Play: Capacitor wraps the Next.js web app + video splash.",
              },
              ].map((f) => (
                <div
                  key={f.title}
                  className="game-card flex h-full flex-col gap-4 p-6 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
                    {f.icon}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <h3 className="text-base font-bold leading-snug text-white">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-white/60">
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="product" className="scroll-mt-[5.5rem]">
            <div className="game-card p-6 sm:p-8 md:p-10">
              <h2 className="mb-5 text-xl font-bold leading-snug text-[var(--gold)] sm:mb-6 sm:text-2xl">
                For App Review & partners
              </h2>
              <ul className="ml-1 space-y-4 text-sm leading-relaxed text-white/75 sm:text-base">
                <li className="flex gap-3 pl-1">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]/80" />
                  <span>
                    <strong className="text-white/90">Product:</strong> LUDINO
                    — multiplayer Ludo with lobby, wallet integration patterns,
                    and optional video UI.
                  </span>
                </li>
                <li className="flex gap-3 pl-1">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]/80" />
                  <span>
                    <strong className="text-white/90">Primary URL:</strong>{" "}
                    this marketing page (share{" "}
                    <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                      /landing
                    </code>{" "}
                    with reviewers).
                  </span>
                </li>
                <li className="flex gap-3 pl-1">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]/80" />
                  <span>
                    <strong className="text-white/90">
                      Support & legal:
                    </strong>{" "}
                    see footer links for privacy, terms, and contact.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section
            id="download"
            className="scroll-mt-[5.5rem] text-center"
          >
            <h2 className="mb-4 text-xl font-bold text-[var(--gold)] sm:mb-5 sm:text-2xl">
              Download
            </h2>
            <p className="mx-auto mb-8 max-w-lg px-2 text-sm leading-relaxed text-white/65 sm:mb-10 sm:text-base">
              Native shells use{" "}
              <strong className="text-white/85">Capacitor</strong> (single
              project: <code className="text-white/70">android/</code>
              {" + "}
              <code className="text-white/70">ios/</code>). The app loads your
              deployed site in a WebView; open the repos in Android Studio /
              Xcode, set <code className="text-white/70">CAPACITOR_SERVER_URL</code>
              , run <code className="text-white/70">npm run cap:sync</code>, then
              build release bundles. Launch video:{" "}
              <code className="text-white/70">/splash/launch.mp4</code>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <span className="rounded-xl border border-white/10 bg-black/40 px-6 py-3.5 text-xs leading-normal text-white/50 sm:py-3">
                Capacitor iOS → App Store (build in Xcode)
              </span>
              <span className="rounded-xl border border-white/10 bg-black/40 px-6 py-3.5 text-xs leading-normal text-white/50 sm:py-3">
                Capacitor Android → Play (Android Studio + Java&nbsp;17)
              </span>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--gold-border)]/25 bg-[var(--card)]/90">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="max-w-md md:max-w-sm">
            <Image
              src="/game/logo.png"
              alt="LUDINO"
              width={160}
              height={56}
              className="mb-4 h-8 w-auto object-contain opacity-90"
              unoptimized
            />
            <p className="text-xs leading-relaxed text-white/55">
              LUDINO / LEDO Game — online Ludo entertainment. Replace the support
              email in code with your production address before submitting to
              stores.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm md:min-w-[10rem]">
            <span className="font-semibold text-[var(--gold)]">
              Legal & support
            </span>
            <Link
              href="/privacy"
              className="py-0.5 text-white/70 hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="py-0.5 text-white/70 hover:text-white"
            >
              Terms of Service
            </Link>
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com"}`}
              className="py-0.5 text-white/70 hover:text-white"
            >
              Contact support
            </a>
          </div>
        </div>
        <p className="border-t border-white/5 px-4 py-6 text-center text-xs text-white/40 sm:py-8">
          © {new Date().getFullYear()} LUDINO. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
