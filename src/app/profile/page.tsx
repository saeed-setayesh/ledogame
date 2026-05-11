import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileComponent from "@/components/profile/Profile";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      email: true,
      level: true,
      xp: true,
      totalGames: true,
      totalWins: true,
      walletBalance: true,
      avatar: true,
      countryCode: true,
      createdAt: true,
    },
  });

  if (!dbUser) {
    redirect("/auth/signin");
  }

  return <ProfileComponent user={dbUser} />;
}
