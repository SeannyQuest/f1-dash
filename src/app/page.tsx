import { Header } from "@/components/layout/Header";
import { DashboardGrid } from "@/components/layout/DashboardGrid";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4">
        <DashboardGrid />
      </main>
    </div>
  );
}
