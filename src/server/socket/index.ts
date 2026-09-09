import { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { gameHandlers, scheduleTurnTimer, handleSocketDisconnect } from "./game-handler"
import { webrtcHandlers, webrtcHandleDisconnect } from "./webrtc-handler"
import { setStateChangeListener } from "@/lib/game/game-state"

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

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`)
      webrtcHandleDisconnect(socket, io!)
      handleSocketDisconnect(socket, io!)
    })
  })

  return io
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io not initialized")
  }
  return io
}

