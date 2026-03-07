import { TIRE_COLORS, TIRE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TireIconProps {
  compound: string;
  className?: string;
  size?: "sm" | "md";
}

export function TireIcon({ compound, className, size = "sm" }: TireIconProps) {
  const color = TIRE_COLORS[compound] ?? TIRE_COLORS.UNKNOWN;
  const label = TIRE_LABELS[compound] ?? "?";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono font-bold",
        size === "sm" ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs",
        className
      )}
      style={{ backgroundColor: color, color: compound === "HARD" ? "#000" : "#fff" }}
    >
      {label}
    </span>
  );
}
