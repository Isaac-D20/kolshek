import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Sliders, Type, Plus, Info } from "lucide-react";
import { QueryInspector, type QueryObject } from "./query-inspector";
import type { WidgetNode, Path } from "./tree-utils";

interface PropertyInspectorProps {
  selectedPath: Path | null;
  selectedNode: WidgetNode | null;
  onUpdateNode: (path: Path, updates: Partial<WidgetNode>) => void;
  onDeleteNode: (path: Path) => void;
}

export function PropertyInspector({
  selectedPath,
  selectedNode,
  onUpdateNode,
  onDeleteNode,
}: PropertyInspectorProps) {
  if (!selectedNode || !selectedPath) {
    return (
      <Card className="h-full flex flex-col border shadow-xs items-center justify-center p-6 text-center text-muted-foreground bg-muted/5">
        <Sliders className="h-8 w-8 mb-2 opacity-40 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">No Component Selected</h3>
        <p className="text-xs max-w-[220px] mt-1 leading-relaxed">
          Click any widget or layout on the canvas to inspect and configure its visual and query properties.
        </p>
      </Card>
    );
  }

  const handleFieldChange = (key: string, value: unknown) => {
    onUpdateNode(selectedPath, { [key]: value });
  };

  const widgetType = selectedNode.type;

  return (
    <Card className="h-full flex flex-col border shadow-xs overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-muted/20 shrink-0">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Properties
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                {widgetType}
              </Badge>
            </div>
            <CardDescription className="text-[11px] truncate max-w-[190px]">
              {selectedNode.title || `Configure ${widgetType}`}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={() => onDeleteNode(selectedPath)}
            title="Delete this component"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-3.5">
        <div className="space-y-4 pb-4">
          {/* Base Properties: Title */}
          {widgetType !== "filter-bar" && (
            <div className="space-y-1.5">
              <Label htmlFor="prop-title" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Type className="h-3 w-3" /> Display Title
              </Label>
              <Input
                id="prop-title"
                placeholder="Optional title"
                className="h-8 text-xs bg-background"
                value={selectedNode.title || ""}
                onChange={(e) => handleFieldChange("title", e.target.value)}
              />
            </div>
          )}

          {/* Stack Properties */}
          {widgetType === "stack" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Direction</Label>
                <Select
                  value={(selectedNode.direction as string) || "vertical"}
                  onValueChange={(val) => handleFieldChange("direction", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Gap (0-16)</Label>
                <Input
                  type="number"
                  min={0}
                  max={16}
                  className="h-8 text-xs bg-background"
                  value={selectedNode.gap !== undefined ? Number(selectedNode.gap) : 4}
                  onChange={(e) => handleFieldChange("gap", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Grid Properties */}
          {widgetType === "grid" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Grid Columns (1-12)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Small (sm)</span>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="h-8 text-xs bg-background"
                    value={(selectedNode.columns as Record<string, number>)?.sm ?? 1}
                    onChange={(e) =>
                      handleFieldChange("columns", {
                        ...((selectedNode.columns as Record<string, number>) || {}),
                        sm: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Medium (md)</span>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="h-8 text-xs bg-background"
                    value={(selectedNode.columns as Record<string, number>)?.md ?? 2}
                    onChange={(e) =>
                      handleFieldChange("columns", {
                        ...((selectedNode.columns as Record<string, number>) || {}),
                        md: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Large (lg)</span>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="h-8 text-xs bg-background"
                    value={(selectedNode.columns as Record<string, number>)?.lg ?? 3}
                    onChange={(e) =>
                      handleFieldChange("columns", {
                        ...((selectedNode.columns as Record<string, number>) || {}),
                        lg: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabs Properties */}
          {widgetType === "tabs" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Tabs List</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => {
                    const tabs = Array.isArray(selectedNode.tabs) ? [...selectedNode.tabs] : [];
                    const nextIndex = tabs.length + 1;
                    tabs.push({
                      label: `Tab ${nextIndex}`,
                      value: `tab-${nextIndex}`,
                      children: [],
                    });
                    handleFieldChange("tabs", tabs);
                  }}
                >
                  <Plus className="h-3 w-3" /> Add Tab
                </Button>
              </div>
              <div className="space-y-2">
                {Array.isArray(selectedNode.tabs) &&
                  selectedNode.tabs.map((tab, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 p-2 rounded-md border bg-muted/20">
                      <Input
                        className="h-7 text-xs bg-background flex-1"
                        value={tab.label}
                        onChange={(e) => {
                          const tabs = [...(selectedNode.tabs as Array<{ label: string; value: string; children: WidgetNode[] }>)];
                          tabs[idx] = { ...tabs[idx], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "-") };
                          handleFieldChange("tabs", tabs);
                        }}
                      />
                      {selectedNode.tabs!.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const tabs = selectedNode.tabs!.filter((_, i) => i !== idx);
                            handleFieldChange("tabs", tabs);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Metric Card Properties */}
          {widgetType === "metric-card" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Format</Label>
                <Select
                  value={(selectedNode.format as string) || "currency"}
                  onValueChange={(val) => handleFieldChange("format", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currency">Currency (₪)</SelectItem>
                    <SelectItem value="number">Plain Number</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Subtitle Label</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  placeholder="e.g. vs previous month"
                  value={(selectedNode.label as string) || ""}
                  onChange={(e) => handleFieldChange("label", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Chart Properties */}
          {widgetType === "chart" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Chart Type</Label>
                <Select
                  value={(selectedNode.chartType as string) || "bar"}
                  onValueChange={(val) => handleFieldChange("chartType", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="donut">Donut Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Height (px)</Label>
                <Input
                  type="number"
                  min={100}
                  max={800}
                  className="h-8 text-xs bg-background"
                  value={selectedNode.height !== undefined ? Number(selectedNode.height) : 300}
                  onChange={(e) => handleFieldChange("height", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Progress Bar Properties */}
          {widgetType === "progress-bar" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Target Goal</Label>
                <Input
                  type="number"
                  className="h-8 text-xs bg-background"
                  value={selectedNode.target !== undefined ? Number(selectedNode.target) : 5000}
                  onChange={(e) => handleFieldChange("target", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Format</Label>
                <Select
                  value={(selectedNode.format as string) || "currency"}
                  onValueChange={(val) => handleFieldChange("format", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currency">Currency (₪)</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Comparison Properties */}
          {widgetType === "comparison" && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">First Label</Label>
                  <Input
                    className="h-8 text-xs bg-background"
                    value={Array.isArray(selectedNode.labels) ? selectedNode.labels[0] : "Income"}
                    onChange={(e) => {
                      const labels = Array.isArray(selectedNode.labels) ? [...selectedNode.labels] : ["Income", "Expenses"];
                      labels[0] = e.target.value;
                      handleFieldChange("labels", labels);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Second Label</Label>
                  <Input
                    className="h-8 text-xs bg-background"
                    value={Array.isArray(selectedNode.labels) ? selectedNode.labels[1] : "Expenses"}
                    onChange={(e) => {
                      const labels = Array.isArray(selectedNode.labels) ? [...selectedNode.labels] : ["Income", "Expenses"];
                      labels[1] = e.target.value;
                      handleFieldChange("labels", labels);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Format</Label>
                  <Select
                    value={(selectedNode.format as string) || "currency"}
                    onValueChange={(val) => handleFieldChange("format", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="currency">Currency (₪)</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Good Direction</Label>
                  <Select
                    value={selectedNode.higherIsBetter === false ? "lower" : "higher"}
                    onValueChange={(val) => handleFieldChange("higherIsBetter", val === "higher")}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="higher">Higher is Better</SelectItem>
                      <SelectItem value="lower">Lower is Better</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Alert Properties */}
          {widgetType === "alert" && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Condition</Label>
                  <Select
                    value={(selectedNode.condition as string) || "above"}
                    onValueChange={(val) => handleFieldChange("condition", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Threshold (&gt;)</SelectItem>
                      <SelectItem value="below">Below Threshold (&lt;)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Threshold Value</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs bg-background"
                    value={selectedNode.threshold !== undefined ? Number(selectedNode.threshold) : 1000}
                    onChange={(e) => handleFieldChange("threshold", Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Severity</Label>
                  <Select
                    value={(selectedNode.severity as string) || "warning"}
                    onValueChange={(val) => handleFieldChange("severity", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error / Danger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Alert Message</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  value={(selectedNode.message as string) || ""}
                  onChange={(e) => handleFieldChange("message", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Text Properties */}
          {widgetType === "text" && (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Content (Markdown supported)</Label>
                <textarea
                  className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  value={(selectedNode.content as string) || ""}
                  onChange={(e) => handleFieldChange("content", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Size</Label>
                  <Select
                    value={(selectedNode.size as string) || "base"}
                    onValueChange={(val) => handleFieldChange("size", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="base">Standard</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                      <SelectItem value="xl">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Card Frame</Label>
                  <Select
                    value={selectedNode.wrapped === false ? "false" : "true"}
                    onValueChange={(val) => handleFieldChange("wrapped", val === "true")}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Wrapped inside Card</SelectItem>
                      <SelectItem value="false">Plain Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar Properties */}
          {widgetType === "filter-bar" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Active Filter Controls</Label>
              <div className="space-y-1.5 p-2 rounded-lg border bg-muted/10">
                {(["dateRange", "category", "provider", "direction"] as const).map((f) => {
                  const currentFilters = Array.isArray(selectedNode.filters) ? (selectedNode.filters as string[]) : [];
                  const isChecked = currentFilters.includes(f);
                  return (
                    <label key={f} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-input text-primary focus:ring-primary"
                        checked={isChecked}
                        onChange={(e) => {
                          const nextFilters = e.target.checked
                            ? [...currentFilters, f]
                            : currentFilters.filter((item) => item !== f);
                          handleFieldChange("filters", nextFilters);
                        }}
                      />
                      <span className="capitalize">{f === "dateRange" ? "Date Period" : f}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Filters sync across all widgets on this page.
              </p>
            </div>
          )}

          {/* Embedded Query Inspector if Widget has query */}
          {selectedNode.query !== undefined && (
            <QueryInspector
              query={selectedNode.query as QueryObject}
              onChange={(updatedQuery) => handleFieldChange("query", updatedQuery)}
            />
          )}

          {/* Dual queries for Comparison widget */}
          {Array.isArray(selectedNode.queries) && (
            <div className="space-y-3">
              <QueryInspector
                title="First Query (Primary)"
                query={selectedNode.queries[0] as QueryObject}
                onChange={(q1) => {
                  const q = [...(selectedNode.queries as QueryObject[])];
                  q[0] = q1;
                  handleFieldChange("queries", q);
                }}
              />
              <QueryInspector
                title="Second Query (Comparison)"
                query={selectedNode.queries[1] as QueryObject}
                onChange={(q2) => {
                  const q = [...(selectedNode.queries as QueryObject[])];
                  q[1] = q2;
                  handleFieldChange("queries", q);
                }}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
