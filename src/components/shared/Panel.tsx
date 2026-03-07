import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn(
        "relative rounded-sm overflow-hidden",
        className
      )}
      style={{
        background: "linear-gradient(180deg, rgb(18, 20, 32) 0%, rgb(12, 14, 24) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
      }}
    >
      {children}
    </div>
  );
}
