// Widget: filter-bar -- date range, category, merchant, account, and direction filters
import { useCallback, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { getCurrentMonth } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProviders } from "@/hooks/use-providers";
import { useCategoryList } from "@/hooks/use-categories";
import { Card, CardContent } from "@/components/ui/card";
import type { WidgetProps } from "./widget-registry.js";

// Direction options for the toggle
const DIRECTION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

export default function WidgetFilterBar({ config, onFilterChange }: WidgetProps) {
  const filterFlags = config.filters as any
  const showDateRange = filterFlags.includes("dateRange");
  const showCategory = filterFlags.includes("category");
  const showProvider = filterFlags.includes("provider");
  const showDirection = filterFlags.includes("direction");
  const { data: categories = [] } = useCategoryList(showCategory);
  const { data: providers = [] } = useProviders(showProvider);

  // Default values
  const currentMonth = getCurrentMonth();
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [category, setCategory] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");

  const emitChange = useCallback(
    (overrides: Record<string, unknown>) => {
      if (!onFilterChange) return;
      onFilterChange({
        period: `${fromMonth}/${toMonth}`,
        category: category,
        provider: provider,
        direction: direction,
        ...overrides,
      });
    },
    [onFilterChange, fromMonth, toMonth, category, provider, direction],
  );

  const handleFromChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setFromMonth(val);
      emitChange({ fromMonth: val });
    },
    [emitChange],
  );

  const handleToChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setToMonth(val);
      emitChange({ toMonth: val });
    },
    [emitChange],
  );

  const handleCategoryChange = useCallback(
    (val: string) => {
      setCategory([val]);
      emitChange({ category: [val] });
    },
    [emitChange],
  );

  const handleProviderChange = useCallback(
    (val: string) => {
      setProvider(val);
      emitChange({ merchant: val === "all" ? undefined : [val] });
    },
    [emitChange],
  );

  const handleDirectionChange = useCallback(
    (val: string) => {
      setDirection(val);
      emitChange({ direction: val });
    },
    [emitChange],
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date range */}
          {showDateRange && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="month"
                  value={fromMonth}
                  onChange={handleFromChange}
                  className="w-36"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="month"
                  value={toMonth}
                  onChange={handleToChange}
                  className="w-36"
                />
              </div>
            </>
          )}

          {/* Category dropdown */}
          {showCategory && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category[0]} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Provider dropdown */}
          {showProvider && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.companyId} value={p.companyId}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Direction toggle */}
          {showDirection && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <div className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted/50 p-1">
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDirectionChange(opt.value)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all duration-150",
                      direction === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
