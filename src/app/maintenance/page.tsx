import Image from "next/image";

export const metadata = {
  title: "LUDINO — Server maintenance",
  robots: "noindex, nofollow",
};

export default function MaintenancePage() {
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
            Server is down
          </h1>

          <p className="text-foreground/70 text-sm md:text-base leading-relaxed">
            LUDINO is temporarily unavailable for maintenance. Please check back
            soon — we&apos;ll be back online shortly.
          </p>

          <p className="text-xs text-foreground/50">
            اگر این پیام را می‌بینید، سرور در حال تعمیر است. لطفاً بعداً دوباره
            امتحان کنید.
          </p>
        </div>

        <p className="text-xs text-foreground/40">
          ludino.net · maintenance mode
        </p>
      </div>
    </div>
  );
}
