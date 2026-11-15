import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Database, Filter, Layers, ArrowUpDown, Calendar } from "lucide-react";

export interface QueryObject {
  type: "aggregate" | "trend" | "transactions" | "balances" | "budget_vs_actual";
  groupBy?: string | null;
  metric?: "sum" | "avg" | "count" | "min" | "max";
  field?: "chargedAmount" | "originalAmount";
  limit?: number;
  offset?: number;
  sort?: string;
  compareTo?: string | null;
  interval?: "day" | "week" | "month";
  series?: "total" | "category" | "merchant";
  month?: string;
  filters?: {
    period?: string;
    direction?: "expense" | "income" | "all";
    type?: "normal" | "installments" | "all";
    amountMin?: number;
    amountMax?: number;
    category?: string[];
    merchant?: string[];
    account?: string[];
  };
  [key: string]: unknown;
}

interface QueryInspectorProps {
  title?: string;
  query: QueryObject | undefined;
  onChange: (updatedQuery: QueryObject) => void;
}

export function QueryInspector({ title = "Data Query", query, onChange }: QueryInspectorProps) {
  const currentQuery: QueryObject = query || { type: "aggregate", metric: "sum" };

  const handleTypeChange = (newType: QueryObject["type"]) => {
    switch (newType) {
      case "aggregate":
        onChange({
          type: "aggregate",
          metric: "sum",
          filters: currentQuery.filters || { direction: "expense" },
        });
        break;
      case "trend":
        onChange({
          type: "trend",
          interval: "day",
          series: "total",
          metric: "sum",
          filters: currentQuery.filters || { direction: "expense" },
        });
        break;
      case "transactions":
        onChange({
          type: "transactions",
          limit: 10,
          sort: "date_desc",
          filters: currentQuery.filters,
        });
        break;
      case "balances":
        onChange({
          type: "balances",
        });
        break;
      case "budget_vs_actual":
        onChange({
          type: "budget_vs_actual",
          filters: currentQuery.filters,
        });
        break;
    }
  };

  const updateField = (key: string, value: unknown) => {
    if (value === undefined || value === "" || value === "none") {
      const copy = { ...currentQuery };
      delete copy[key];
      onChange(copy);
    } else {
      onChange({ ...currentQuery, [key]: value });
    }
  };

  const updateFilter = (filterKey: string, value: unknown) => {
    const existingFilters = { ...(currentQuery.filters || {}) };
    if (value === undefined || value === "" || value === "none" || (typeof value === "number" && isNaN(value))) {
      delete (existingFilters as Record<string, unknown>)[filterKey];
    } else {
      (existingFilters as Record<string, unknown>)[filterKey] = value;
    }

    if (Object.keys(existingFilters).length === 0) {
      const copy = { ...currentQuery };
      delete copy.filters;
      onChange(copy);
    } else {
      onChange({ ...currentQuery, filters: existingFilters });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card/40 p-3.5 shadow-xs">
      <div className="flex items-center justify-between pb-1 border-b border-border/60">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span>{title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono capitalize px-1.5 py-0">
          {currentQuery.type}
        </Badge>
      </div>

      {/* Query Type Selector */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Layers className="h-3 w-3" /> Query Type
        </Label>
        <Select
          value={currentQuery.type}
          onValueChange={(val) => handleTypeChange(val as QueryObject["type"])}
        >
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue placeholder="Select query type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aggregate">Aggregate (Sum, Avg, Group By)</SelectItem>
            <SelectItem value="trend">Trend (Time-series intervals)</SelectItem>
            <SelectItem value="transactions">Transactions (Itemized list)</SelectItem>
            <SelectItem value="balances">Account Balances</SelectItem>
            <SelectItem value="budget_vs_actual">Budget vs. Actual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Aggregate Controls */}
      {currentQuery.type === "aggregate" && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Metric</Label>
            <Select
              value={currentQuery.metric || "sum"}
              onValueChange={(val) => updateField("metric", val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Sum (Total)</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="min">Minimum</SelectItem>
                <SelectItem value="max">Maximum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Group By</Label>
            <Select
              value={currentQuery.groupBy || "none"}
              onValueChange={(val) => updateField("groupBy", val === "none" ? undefined : val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Single total)</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="merchant">Merchant</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Sort</Label>
            <Select
              value={currentQuery.sort || "none"}
              onValueChange={(val) => updateField("sort", val === "none" ? undefined : val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default</SelectItem>
                <SelectItem value="value_desc">Highest value first</SelectItem>
                <SelectItem value="value_asc">Lowest value first</SelectItem>
                <SelectItem value="label_asc">Alphabetical (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Compare To</Label>
            <Select
              value={currentQuery.compareTo || "none"}
              onValueChange={(val) => updateField("compareTo", val === "none" ? undefined : val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="previous_period">Previous Period</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Result Limit</Label>
            <Input
              type="number"
              placeholder="e.g. 10 (optional)"
              className="h-8 text-xs bg-background"
              value={currentQuery.limit ?? ""}
              onChange={(e) => updateField("limit", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
      )}

      {/* Trend Controls */}
      {currentQuery.type === "trend" && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Interval</Label>
            <Select
              value={currentQuery.interval || "day"}
              onValueChange={(val) => updateField("interval", val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Series Grouping</Label>
            <Select
              value={currentQuery.series || "total"}
              onValueChange={(val) => updateField("series", val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total Aggregate</SelectItem>
                <SelectItem value="category">By Category</SelectItem>
                <SelectItem value="merchant">By Merchant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Metric</Label>
            <Select
              value={currentQuery.metric || "sum"}
              onValueChange={(val) => updateField("metric", val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Transactions Controls */}
      {currentQuery.type === "transactions" && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" /> Sort Order
            </Label>
            <Select
              value={currentQuery.sort || "date_desc"}
              onValueChange={(val) => updateField("sort", val)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest First (date_desc)</SelectItem>
                <SelectItem value="date_asc">Oldest First (date_asc)</SelectItem>
                <SelectItem value="amount_desc">Highest Amount (amount_desc)</SelectItem>
                <SelectItem value="amount_asc">Lowest Amount (amount_asc)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Limit</Label>
            <Input
              type="number"
              placeholder="10"
              className="h-8 text-xs bg-background"
              value={currentQuery.limit ?? ""}
              onChange={(e) => updateField("limit", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
      )}

      {/* Budget vs Actual Controls */}
      {currentQuery.type === "budget_vs_actual" && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Month (YYYY-MM)
          </Label>
          <Input
            placeholder="e.g. 2026-11 (leave blank for current)"
            className="h-8 text-xs bg-background"
            value={currentQuery.month || ""}
            onChange={(e) => updateField("month", e.target.value || undefined)}
          />
        </div>
      )}

      {/* Filter Section */}
      {currentQuery.type !== "balances" && (
        <div className="pt-2 border-t border-border/60 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>Query Filters</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Direction</Label>
              <Select
                value={currentQuery.filters?.direction || "all"}
                onValueChange={(val) => updateFilter("direction", val === "all" ? undefined : val)}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="expense">Expenses Only</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Period</Label>
              <Select
                value={currentQuery.filters?.period || "none"}
                onValueChange={(val) => updateFilter("period", val === "none" ? undefined : val)}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder="Inherit / All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Inherit / All</SelectItem>
                  <SelectItem value="month">Current Month</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value={String(new Date().getFullYear())}>This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Min Amount (₪)</Label>
              <Input
                type="number"
                placeholder="Min"
                className="h-7 text-xs bg-background"
                value={currentQuery.filters?.amountMin ?? ""}
                onChange={(e) => updateFilter("amountMin", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Max Amount (₪)</Label>
              <Input
                type="number"
                placeholder="Max"
                className="h-7 text-xs bg-background"
                value={currentQuery.filters?.amountMax ?? ""}
                onChange={(e) => updateFilter("amountMax", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
