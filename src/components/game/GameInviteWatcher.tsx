"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

interface Invite {
  id: string;
  gameId: string;
  entryFee: number;
  gameMode: string;
  sender: { id: string; username: string; avatar: string | null; level: number };
}

/**
 * Polls for incoming game invites from friends and shows an accept / decline
 * prompt anywhere in the app (except while already inside a game).
 */
export default function GameInviteWatcher() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  const active = status === "authenticated" && !pathname?.startsWith("/game/");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/game/invite", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const next: Invite | undefined = data.invites?.[0];
      setInvite((cur) => {
        if (!next) return null;
        if (cur && cur.id === next.id) return cur;
        return next;
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setInvite(null);
      return;
    }
    void poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [active, poll]);

  const respond = async (accept: boolean) => {
    if (!invite || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/game/invite/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id, accept }),
      });
      const data = await res.json();
      setInvite(null);
      if (accept && res.ok && data.gameId) {
        router.push(`/game/${data.gameId}`);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  if (!invite) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[200] flex justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-[#f2a51e] bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl">
            {invite.sender.avatar || "👤"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {invite.sender.username} challenges you!
            </div>
            <div className="text-xs text-white/60">
              {invite.gameMode === "RUSH" ? "Rush" : "Classic"} ·{" "}
              {invite.entryFee > 0 ? `${invite.entryFee} USDT` : "Free"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => respond(true)}
            disabled={busy}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => respond(false)}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
