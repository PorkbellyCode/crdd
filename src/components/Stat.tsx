import { cn } from "@/lib/utils";

/** 숫자 한 줄 + 레이블. 대시보드 상단 요약 띠에 쓴다 */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "my-5 flex flex-wrap overflow-hidden rounded-lg border border-border bg-editor",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  value,
  label,
  valueClassName,
}: {
  value: React.ReactNode;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex-1 basis-32 border-r border-border px-4 py-3 last:border-r-0">
      <b className={cn("block text-xl font-bold tracking-tight tabular", valueClassName)}>
        {value}
      </b>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
