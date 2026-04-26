// This route is for Socket.io connection endpoint
// The actual Socket.io server is initialized in a separate server file
export async function GET() {
  return new Response("Socket.io endpoint", { status: 200 })
}

