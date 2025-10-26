import DashboardCharts from "./DashboardCharts";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-100/80 via-white/70 to-emerald-50/80 px-6 py-6 shadow-[0_22px_45px_rgba(16,185,129,0.18)] backdrop-blur">
        <h2 className="text-2xl font-semibold text-emerald-950">
          Zero-based budget pulse
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-900/80">
          Keep every dollar on mission with a mix of projected budgets, actual
          cashflow, and pacing insights. These visuals stitch together income,
          envelopes, categories, and transaction trends to surface what changed,
          what&apos;s working, and where to adjust next.
        </p>
      </header>

      <DashboardCharts />
    </section>
  );
}
