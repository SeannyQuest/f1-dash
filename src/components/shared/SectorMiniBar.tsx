import { SECTOR_COLORS } from "@/lib/constants";

type SectorStatus = "overallBest" | "personalBest" | "slower" | "noData";

interface SectorMiniBarProps {
  s1: SectorStatus;
  s2: SectorStatus;
  s3: SectorStatus;
}

export function SectorMiniBar({ s1, s2, s3 }: SectorMiniBarProps) {
  return (
    <span className="inline-flex gap-[2px]">
      {[s1, s2, s3].map((status, i) => (
        <span
          key={i}
          className="w-[14px] h-[6px] rounded-[1px]"
          style={{
            backgroundColor: SECTOR_COLORS[status],
            boxShadow:
              status === "overallBest"
                ? `0 0 6px ${SECTOR_COLORS[status]}80`
                : status === "personalBest"
                  ? `0 0 4px ${SECTOR_COLORS[status]}60`
                  : "none",
          }}
        />
      ))}
    </span>
  );
}
