"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Sailor = {
  id: string
  full_name: string
  rank: string
}

export default function LeadershipLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [sailorId, setSailorId] = useState("")
  const [message, setMessage] = useState("")
  const [sailors, setSailors] = useState<Sailor[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("sailors")
        .select("id, full_name, rank")
        .order("full_name")
      setSailors((data ?? []) as Sailor[])
    }
    load()
  }, [])

  const login = async () => {
    setMessage("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "leadership",
        password,
        sailorId,
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
        <h1 className="text-3xl font-bold">Leadership Login</h1>
        <p className="mt-2 text-sm">
          Enter the leadership password and choose your Sailor identity.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Leadership Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Your Sailor Identity</label>
            <select
              value={sailorId}
              onChange={(e) => setSailorId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select Sailor</option>
              {sailors.map((sailor) => (
                <option key={sailor.id} value={sailor.id}>
                  {sailor.rank} {sailor.full_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={login}
            className="w-full rounded-lg bg-[#d4af37] py-3 font-semibold text-black"
          >
            Login as Leadership
          </button>

          <a
            href="/admin-login"
            className="block text-center text-sm font-semibold text-blue-700 underline"
          >
            Go to Admin Login
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