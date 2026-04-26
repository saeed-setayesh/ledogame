import { getSocket } from "../socket/client"

export function setupWebRTCSignaling(
  gameId: string,
  userId: string,
  onRemoteStream: (peerId: string, stream: MediaStream) => void
) {
  const socket = getSocket()

  socket.on("webrtc:offer", async ({ from, offer }) => {
    // Handle incoming offer
    // Create answer and send back
  })

  socket.on("webrtc:answer", async ({ from, answer }) => {
    // Handle incoming answer
  })

  socket.on("webrtc:ice-candidate", async ({ from, candidate }) => {
    // Handle ICE candidate
  })

  return {
    sendOffer: (to: string, offer: RTCSessionDescriptionInit) => {
      socket.emit("webrtc:offer", { gameId, to, offer })
    },
    sendAnswer: (to: string, answer: RTCSessionDescriptionInit) => {
      socket.emit("webrtc:answer", { gameId, to, answer })
    },
    sendIceCandidate: (to: string, candidate: RTCIceCandidateInit) => {
      socket.emit("webrtc:ice-candidate", { gameId, to, candidate })
    },
  }
}

