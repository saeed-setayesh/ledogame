import { prisma } from "@/lib/prisma";
import { AIPlayer } from "./ai-player";

/**
 * Get or create AI user
 */
export async function getOrCreateAIUser(index: number = 0) {
  const aiUserId = AIPlayer.generateAIUserId(index);
  const username = AIPlayer.getAIUsername(aiUserId);

  // Try to find existing AI user
  let aiUser = await prisma.user.findUnique({
    where: { id: aiUserId },
  });

  if (!aiUser) {
    // Create AI user
    try {
      aiUser = await prisma.user.create({
        data: {
          id: aiUserId,
          email: `ai_${index}@ledo.game`,
          username: username,
          password: "ai_password_hash", // Not used for AI
          walletBalance: 1000, // AI has unlimited balance
          level: Math.floor(Math.random() * 10) + 1, // Random level 1-10
          xp: 0,
          totalGames: 0,
          totalWins: 0,
          avatar: null,
          isAdmin: false,
        },
      });
    } catch (error: any) {
      // If user already exists (race condition), fetch it
      if (error.code === "P2002") {
        aiUser = await prisma.user.findUnique({
          where: { id: aiUserId },
        });
      } else {
        throw error;
      }
    }
  }

  return aiUser;
}

/**
 * Get or create multiple AI users
 */
export async function getOrCreateAIUsers(count: number) {
  const aiUsers = [];
  for (let i = 0; i < count; i++) {
    const user = await getOrCreateAIUser(i);
    aiUsers.push(user);
  }
  return aiUsers;
}
