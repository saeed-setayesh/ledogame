import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GamePage from "@/components/game/GamePage";

export default async function GameRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!game) {
    redirect("/lobby");
  }

  const currentPlayer = game.players.find((p) => p.userId === user.id);
  if (!currentPlayer) {
    redirect("/lobby");
  }

  // Serialize Decimal values to strings for client component
  const serializedGame = {
    ...game,
    entryFee: game.entryFee.toString(),
    totalPot: game.totalPot.toString(),
    commissionAmount: game.commissionAmount.toString(),
    players: game.players.map((player) => ({
      ...player,
      payoutAmount: player.payoutAmount.toString(),
    })),
  };

  return <GamePage game={serializedGame} currentUserId={user.id} />;
}
