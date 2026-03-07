import { Panel } from "@/components/shared/Panel";
import { StatusDot } from "@/components/shared/StatusDot";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PanelWrapperProps {
  title: string;
  isLive?: boolean;
  children: ReactNode;
  className?: string;
  rightSection?: ReactNode;
}

export function PanelWrapper({
  title,
  isLive = false,
  children,
  className,
  rightSection,
}: PanelWrapperProps) {
  return (
    <Panel className={cn("flex flex-col overflow-hidden", className)}>
      {/* Header with red gradient accent */}
      <div
        className="relative flex items-center justify-between px-3 py-2"
        style={{
          background: "linear-gradient(90deg, rgba(225, 6, 0, 0.12) 0%, rgba(225, 6, 0, 0.03) 40%, transparent 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Left red accent line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: "linear-gradient(180deg, #E10600 0%, rgba(225, 6, 0, 0.3) 100%)",
          }}
        />
        <div className="flex items-center gap-2 pl-1">
          {isLive && <StatusDot isLive={true} />}
          <h2 className="text-[11px] font-bold text-white/70 uppercase tracking-[0.15em]">
            {title}
          </h2>
        </div>
        {rightSection && <div>{rightSection}</div>}
      </div>
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </Panel>
  );
}
