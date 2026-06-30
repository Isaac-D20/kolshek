// Widget: progress-bar -- budget/goal progress display with color thresholds
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

function ProgressSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}

export default function WidgetProgressBar({ config, data }: WidgetProps) {
  const title = (config.title as string) || "Progress";
  const target = (config.target as number) || 100;
  const format = (config.format as string) || "currency";

  // Loading state
  if (data === undefined) {
    return <ProgressSkeleton />;
  }

  // Resolve current and target values
  const currentValue = Number((data as any).value ?? undefined);
  const isValidCurrent = !Number.isNaN(currentValue);
  const isValidTarget = !Number.isNaN(target) && target > 0;

  // Calculate percentage (cap display at 100% for progress bar, but show real % in text)
  const percentage = isValidCurrent && isValidTarget
    ? (currentValue / target) * 100
    : 0;
  const clampedPercentage = Math.min(percentage, 100);

  // Color thresholds: green (<75%), amber (75-100%), red (>100%)
  const colorClass =
    percentage > 100
      ? "text-red-600 dark:text-red-400"
      : percentage >= 75
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  const barColorClass =
    percentage > 100
      ? "[&>div]:bg-red-500"
      : percentage >= 75
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-emerald-500";

  // Format display values
  function formatVal(val: number): string {
    if (format === "currency") return formatCurrency(val);
    if (format === "percent") return `${val.toFixed(1)}%`;
    return val.toLocaleString();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={clampedPercentage}
          className={cn("h-2", barColorClass)}
        />
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">
            {isValidCurrent ? formatVal(currentValue) : "--"}
            {isValidTarget && (
              <>
                {" / "}
                <span className="font-medium text-foreground">
                  {formatVal(target)}
                </span>
              </>
            )}
          </span>
          <span className={cn("font-medium tabular-nums", colorClass)}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
