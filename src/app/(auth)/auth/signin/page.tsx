"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Dices } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        username: isRegister ? username : undefined,
        isRegister: isRegister.toString(),
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="game-bg flex items-center justify-center p-4">
      {/* Corner ornaments */}
      <svg className="pointer-events-none absolute top-4 left-4 w-12 h-12 opacity-15" viewBox="0 0 80 80" fill="none">
        <path d="M0 0 L80 0 L80 10 L10 10 L10 80 L0 80Z" fill="#ffd700" />
      </svg>
      <svg className="pointer-events-none absolute top-4 right-4 w-12 h-12 opacity-15" viewBox="0 0 80 80" fill="none">
        <path d="M80 0 L0 0 L0 10 L70 10 L70 80 L80 80Z" fill="#ffd700" />
      </svg>
      <svg className="pointer-events-none absolute bottom-4 left-4 w-12 h-12 opacity-15" viewBox="0 0 80 80" fill="none">
        <path d="M0 80 L80 80 L80 70 L10 70 L10 0 L0 0Z" fill="#ffd700" />
      </svg>
      <svg className="pointer-events-none absolute bottom-4 right-4 w-12 h-12 opacity-15" viewBox="0 0 80 80" fill="none">
        <path d="M80 80 L0 80 L0 70 L70 70 L70 0 L80 0Z" fill="#ffd700" />
      </svg>

      <div className="w-full max-w-sm relative">
        <div className="game-card p-6 md:p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Dices className="w-6 h-6" style={{ color: "#ffd700" }} />
              <h1
                className="text-4xl font-extrabold tracking-wider"
                style={{
                  color: "#ffd700",
                  textShadow: "0 0 30px rgba(255,215,0,0.25), 0 4px 15px rgba(0,0,0,0.8)",
                }}
              >
                LEDO
              </h1>
              <Dices className="w-6 h-6" style={{ color: "#ffd700" }} />
            </div>
            <div className="game-divider" />
            <p className="text-sm opacity-50 mt-3">
              {isRegister ? "Create your account" : "Welcome back, warrior!"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.3)", color: "#ff6b6b" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="username" className="block text-xs font-bold mb-1.5 uppercase tracking-wider opacity-50">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,215,0,0.10)",
                    color: "#fff0d6",
                  }}
                  placeholder="Choose a username"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold mb-1.5 uppercase tracking-wider opacity-50">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,215,0,0.10)",
                  color: "#fff0d6",
                }}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold mb-1.5 uppercase tracking-wider opacity-50">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,215,0,0.10)",
                  color: "#fff0d6",
                }}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="game-play-btn w-full text-center justify-center mt-2"
              style={{ fontSize: "1rem", padding: "14px 20px" }}
            >
              {loading ? "Loading..." : isRegister ? "CREATE ACCOUNT" : "ENTER GAME"}
            </button>
          </form>

          <div className="game-divider mt-6" />

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs font-medium transition-colors"
              style={{ color: "rgba(255,215,0,0.5)", minHeight: "auto" }}
            >
              {isRegister
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
