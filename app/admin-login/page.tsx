"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  const login = async () => {
    setMessage("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "admin",
        password,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || "Login failed.")
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-black shadow-sm">
        <h1 className="text-3xl font-bold">Admin Login</h1>
        <p className="mt-2 text-sm">
          Enter the admin password for full access.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

          <button
            onClick={login}
            className="w-full rounded-lg bg-[#d4af37] py-3 font-semibold text-black"
          >
            Login as Admin
          </button>

          <a
            href="/leadership-login"
            className="block text-center text-sm font-semibold text-blue-700 underline"
          >
            Go to Leadership Login
          </a>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {message}
          </div>
        )}
      </div>
    </main>
  )
}