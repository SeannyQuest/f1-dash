import { GlassCard } from "@/components/shared/GlassCard";
import { StatusDot } from "@/components/shared/StatusDot";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PanelWrapperProps {
  title: string;
  isLive?: boolean;
  children: ReactNode;
  className?: string;
}

export function PanelWrapper({ title, isLive = false, children, className }: PanelWrapperProps) {
  return (
    <GlassCard className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {isLive && <StatusDot isLive={true} />}
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </GlassCard>
  );
}
