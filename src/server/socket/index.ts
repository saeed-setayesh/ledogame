import { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { gameHandlers, scheduleTurnTimer, handleSocketDisconnect } from "./game-handler"
import { webrtcHandlers, webrtcHandleDisconnect } from "./webrtc-handler"
import { setStateChangeListener } from "@/lib/game/game-state"
import { pairWaitingLobbies } from "@/lib/game/matchmaking"

let io: SocketIOServer | null = null

export function initializeSocket(server: HTTPServer) {
  if (io) {
    return io
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket",
  })

  // Track last broadcast status so we can push a fresh state to everyone in the
  // room the moment a game flips WAITING -> ACTIVE (matchmaking / invites).
  const lastStatus = new Map<string, string>()

  setStateChangeListener((gameId, state) => {
    scheduleTurnTimer(gameId, io!, state)

    const prev = lastStatus.get(gameId)
    lastStatus.set(gameId, state.gameStatus)
    if (prev !== state.gameStatus) {
      io!.to(`game:${gameId}`).emit("game:state", { gameState: state })
      if (state.gameStatus === "ACTIVE" && prev === "WAITING") {
        io!.to(`game:${gameId}`).emit("game:started", { gameId })
      }
    }
  })

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`)

    // Handle game events
    gameHandlers(socket, io!)
    webrtcHandlers(socket, io!)

    // Quick Match: while a client is on the "searching" screen it subscribes
    // here so the server-side pairer can push it straight into its game.
    socket.on("match:subscribe", ({ userId }: { userId?: string }) => {
      if (userId) {
        socket.data.matchUserId = userId
        socket.join(`match:${userId}`)
      }
    })
    socket.on("match:unsubscribe", ({ userId }: { userId?: string }) => {
      if (userId) socket.leave(`match:${userId}`)
    })

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`)
      webrtcHandleDisconnect(socket, io!)
      handleSocketDisconnect(socket, io!)
    })
  })

  // Server-side matchmaking pass: pairs any two waiting lobbies in the same
  // bucket every couple of seconds, so pairing never depends on a client poll.
  let pairing = false
  setInterval(async () => {
    if (pairing) return
    pairing = true
    try {
      const started = await pairWaitingLobbies()
      for (const { gameId, userIds } of started) {
        io!.to(`game:${gameId}`).emit("game:started", { gameId })
        for (const uid of userIds) {
          io!.to(`match:${uid}`).emit("match:found", { gameId })
        }
      }
    } catch (err) {
      console.error("pairWaitingLobbies error:", err)
    } finally {
      pairing = false
    }
  }, 2000)

  return io
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io not initialized")
  }
  return io
}

