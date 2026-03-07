import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}
