import DashboardCharts from "./DashboardCharts";
import { getDashboardData } from "./data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return (
    <section className="space-y-6">
      <DashboardCharts data={data} />
    </section>
  );
}
