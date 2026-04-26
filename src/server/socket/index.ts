import { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { gameHandlers } from "./game-handler"

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

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`)

    // Handle game events
    gameHandlers(socket, io)

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`)
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

