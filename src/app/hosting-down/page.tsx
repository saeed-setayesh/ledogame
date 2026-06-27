import Image from "next/image";

export const metadata = {
  title: "LUDINO — Hosting unavailable",
  robots: "noindex, nofollow",
};

export default function HostingDownPage() {
  return (
    <div className="game-bg min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <Image
            src="/game/logo.png"
            alt="LUDINO"
            width={160}
            height={64}
            className="h-14 w-auto object-contain"
            priority
          />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center">
            <span className="text-2xl" aria-hidden>⚠</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Hosting is down
          </h1>

          <p className="text-foreground/70 text-sm md:text-base leading-relaxed">
            This site is not reachable because the server hosting has been
            suspended — usually due to an unpaid hosting bill. LUDINO itself is
            not under maintenance; the infrastructure provider has turned off the
            server.
          </p>

          <p className="text-foreground/60 text-sm leading-relaxed">
            The site will return once hosting payment is resolved. If you run
            this project, renew your hosting plan (e.g. Railway, VPS, or your
            provider) and turn off{" "}
            <code className="text-xs bg-background/80 px-1.5 py-0.5 rounded">
              SERVER_DOWN
            </code>{' '}
            in your environment.
          </p>

          <p className="text-xs text-foreground/50 leading-relaxed">
            این سایت به‌دلیل قطع یا تعلیق هاستینگ (معمولاً پرداخت نشدن هاست)
            در دسترس نیست — نه به‌خاطر تعمیر خود پلتفرم لدینو.
          </p>
        </div>

        <p className="text-xs text-foreground/40">
          ludino.net · hosting suspended
        </p>
      </div>
    </div>
  );
}
