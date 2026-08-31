import { Socket, Server as SocketIOServer } from "socket.io";
import { AIPlayer } from "@/lib/game/ai-player";

/**
 * Thin WebRTC signaling relay. The server never touches media — it only
 * forwards SDP / ICE between the human sockets in a game room and keeps a
 * lightweight presence list so clients know who to connect to.
 *
 * Rooms:
 *   game:<gameId>  - all sockets watching a game (joined in game-handler)
 *   rtc:<userId>   - every socket for one user (for addressed signaling)
 */
export function webrtcHandlers(socket: Socket, io: SocketIOServer) {
  socket.on(
    "webrtc:join",
    async ({
      gameId,
      userId: claimedUserId,
    }: {
      gameId: string;
      userId?: string;
    }) => {
      // game:join normally sets socket.data.userId first, but child effects can
      // race ahead of it — fall back to the id the client sends.
      const userId =
        (socket.data?.userId as string | undefined) || claimedUserId;
      if (!gameId || !userId || AIPlayer.isAIPlayer(userId)) return;
      socket.data.userId = userId;
      socket.data.rtcGameId = gameId;
      socket.join(`rtc:${userId}`);

      const roomSockets = await io.in(`game:${gameId}`).fetchSockets();
      const peers = [
        ...new Set(
          roomSockets
            .map((s) => s.data?.userId as string | undefined)
            .filter(
              (u): u is string =>
                !!u && u !== userId && !AIPlayer.isAIPlayer(u)
            )
        ),
      ];

      socket.emit("webrtc:peers", { peers });
      socket.to(`game:${gameId}`).emit("webrtc:peer-joined", { userId });
    }
  );

  socket.on(
    "webrtc:signal",
    ({ toUserId, data }: { toUserId: string; data: unknown }) => {
      const fromUserId = socket.data?.userId as string | undefined;
      if (!fromUserId || !toUserId) return;
      io.to(`rtc:${toUserId}`).emit("webrtc:signal", { fromUserId, data });
    }
  );

  socket.on("webrtc:leave", ({ gameId }: { gameId?: string }) => {
    const userId = socket.data?.userId as string | undefined;
    const gid = gameId || (socket.data?.rtcGameId as string | undefined);
    if (!userId || !gid) return;
    socket.leave(`rtc:${userId}`);
    socket.to(`game:${gid}`).emit("webrtc:peer-left", { userId });
  });
}

/** Called from the shared disconnect handler. */
export function webrtcHandleDisconnect(socket: Socket, io: SocketIOServer) {
  const userId = socket.data?.userId as string | undefined;
  const gid = socket.data?.rtcGameId as string | undefined;
  if (!userId || !gid) return;
  socket.to(`game:${gid}`).emit("webrtc:peer-left", { userId });
}
