import { supabase } from "@/lib/supabase"

type AuditRow = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  changed_by: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

export default async function AuditLogPage() {
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  const rows = (data ?? []) as AuditRow[]

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Audit Log</h1>
            <p className="mt-2 text-sm">
              Leadership and admin activity trail.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 space-y-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-yellow-600 bg-gray-50 p-4"
            >
              <p className="font-semibold">
                {row.entity_type} · {row.action}
              </p>
              <p className="text-sm">Entity ID: {row.entity_id}</p>
              <p className="text-sm">Changed By: {row.changed_by || "Unknown"}</p>
              <p className="text-sm">When: {row.created_at}</p>

              <details className="mt-3">
                <summary className="cursor-pointer font-medium">View Details</summary>
                <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs">
                  {JSON.stringify(
                    {
                      old_value: row.old_value,
                      new_value: row.new_value,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}