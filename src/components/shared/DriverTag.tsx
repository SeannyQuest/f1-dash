import { cn } from "@/lib/utils";

interface DriverTagProps {
  acronym: string;
  teamColour: string;
  className?: string;
}

export function DriverTag({ acronym, teamColour, className }: DriverTagProps) {
  const color = teamColour.startsWith("#") ? teamColour : `#${teamColour}`;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-sm font-semibold", className)}>
      <span className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
      {acronym}
    </span>
  );
}
