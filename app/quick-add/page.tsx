export default function QuickAddPage() {
  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <h1 className="text-3xl font-bold text-black">Quick Add</h1>
        <p className="mt-2 text-black">
          This is the fast-entry point for leadership updates.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <a
            href="/quick-add/add-sailor"
            className="rounded-2xl border border-yellow-600 bg-[#d4af37] p-4 text-left shadow-sm hover:opacity-90"
          >
            <p className="font-semibold text-black">Add Sailor</p>
            <p className="mt-1 text-sm text-black">
              Enter new personnel data quickly.
            </p>
          </a>

          <a
            href="/reminder-generator"
            className="rounded-2xl border border-yellow-600 bg-[#d4af37] p-4 text-left shadow-sm hover:opacity-90"
          >
            <p className="font-semibold text-black">Draft Reminder</p>
            <p className="mt-1 text-sm text-black">
              Generate a ready-to-send reminder message.
            </p>
          </a>

          <div className="rounded-2xl border border-yellow-600 bg-white p-4 text-left shadow-sm">
            <p className="font-semibold text-black">Log Counseling</p>
            <p className="mt-1 text-sm text-black">
              Coming next.
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-600 bg-white p-4 text-left shadow-sm">
            <p className="font-semibold text-black">Add Collateral</p>
            <p className="mt-1 text-sm text-black">
              Coming next.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <a
            href="/"
            className="inline-block rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm hover:opacity-90"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}