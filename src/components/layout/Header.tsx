"use client";

import { Activity } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-cyan-primary" />
        <h1 className="text-xl font-bold tracking-tight">
          F1 <span className="text-cyan-primary">Dash</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
        <span>Powered by OpenF1</span>
      </div>
    </header>
  );
}
