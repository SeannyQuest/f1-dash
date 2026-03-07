import { cn } from "@/lib/utils";

interface StatusDotProps {
  isLive: boolean;
  className?: string;
}

export function StatusDot({ isLive, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        isLive
          ? "bg-green-flag animate-[pulse-glow_2s_ease-in-out_infinite]"
          : "bg-white/30",
        className
      )}
    />
  );
}
