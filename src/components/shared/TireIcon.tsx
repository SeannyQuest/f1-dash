import { TIRE_COLORS, TIRE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TireIconProps {
  compound: string;
  className?: string;
  size?: "xs" | "sm" | "md";
}

export function TireIcon({ compound, className, size = "sm" }: TireIconProps) {
  const color = TIRE_COLORS[compound] ?? TIRE_COLORS.UNKNOWN;
  const label = TIRE_LABELS[compound] ?? "?";
  const sizeClasses = {
    xs: "w-3.5 h-3.5 text-[8px]",
    sm: "w-5 h-5 text-[10px]",
    md: "w-7 h-7 text-xs",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono font-bold",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: color,
        color: compound === "HARD" ? "#000" : "#fff",
      }}
    >
      {label}
    </span>
  );
}
