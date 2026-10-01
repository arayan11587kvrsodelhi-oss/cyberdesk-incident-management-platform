import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="label text-[var(--accent)]">Error 404</p>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">That record is not here</h1>
      <p className="max-w-[46ch] text-[13px] leading-relaxed text-[var(--muted)]">
        The page you asked for does not exist in this workspace — it may have been deleted, or the link is
        pointing at something outside the demo data set.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/dashboard"
          className="h-9 rounded-[4px] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[#04140A] transition-[filter] hover:brightness-110"
        >
          Back to overview
        </Link>
        <Link
          href="/incidents"
          className="h-9 rounded-[4px] border border-[var(--border-strong)] px-4 text-[13px] transition-colors hover:bg-[var(--hover)]"
        >
          Incident ledger
        </Link>
      </div>
    </div>
  );
}
