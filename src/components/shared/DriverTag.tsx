import { cn } from "@/lib/utils";

interface DriverTagProps {
  acronym: string;
  teamColour: string;
  className?: string;
}

export function DriverTag({ acronym, teamColour, className }: DriverTagProps) {
  const color = teamColour.startsWith("#") ? teamColour : `#${teamColour}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs font-bold",
        className,
      )}
    >
      <span
        className="w-[3px] h-4 rounded-[1px]"
        style={{ backgroundColor: color }}
      />
      {acronym}
    </span>
  );
}
