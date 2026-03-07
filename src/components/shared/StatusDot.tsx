import { cn } from "@/lib/utils";

interface StatusDotProps {
  isLive: boolean;
  className?: string;
}

export function StatusDot({ isLive, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full",
          isLive
            ? "bg-accent animate-[live-pulse_2s_ease-in-out_infinite]"
            : "bg-white/30",
        )}
        style={
          isLive
            ? { boxShadow: "0 0 8px rgba(225, 6, 0, 0.6), 0 0 16px rgba(225, 6, 0, 0.3)" }
            : undefined
        }
      />
      {isLive && (
        <span
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{
            color: "#E10600",
            textShadow: "0 0 8px rgba(225, 6, 0, 0.4)",
          }}
        >
          LIVE
        </span>
      )}
    </span>
  );
}
