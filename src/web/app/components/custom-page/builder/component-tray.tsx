import React from "react";
import {
  Layers,
  LayoutGrid,
  FolderKanban,
  Hash,
  BarChart3,
  Table as TableIcon,
  Percent,
  GitCompare,
  AlertTriangle,
  Type,
  SlidersHorizontal,
  Plus,
  GripVertical,
} from "lucide-react";
import { WIDGET_DEFAULTS, type WidgetNode } from "./tree-utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComponentTrayProps {
  onAddWidget: (node: WidgetNode) => void;
}

interface ComponentItem {
  type: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LAYOUT_COMPONENTS: ComponentItem[] = [
  {
    type: "stack",
    name: "Stack",
    description: "Vertical or horizontal flex container",
    icon: Layers,
  },
  {
    type: "grid",
    name: "Grid",
    description: "Responsive multi-column grid layout",
    icon: LayoutGrid,
  },
  {
    type: "tabs",
    name: "Tabs",
    description: "Tabbed panels for organized views",
    icon: FolderKanban,
  },
];

const METRIC_COMPONENTS: ComponentItem[] = [
  {
    type: "metric-card",
    name: "Metric Card",
    description: "Single KPI or aggregate statistic",
    icon: Hash,
  },
  {
    type: "chart",
    name: "Chart",
    description: "Line, bar, area, pie, or donut chart",
    icon: BarChart3,
  },
  {
    type: "progress-bar",
    name: "Progress Bar",
    description: "Budget or target achievement bar",
    icon: Percent,
  },
  {
    type: "comparison",
    name: "Comparison",
    description: "Side-by-side comparison of two queries",
    icon: GitCompare,
  },
  {
    type: "alert",
    name: "Alert",
    description: "Conditional threshold warning box",
    icon: AlertTriangle,
  },
];

const CONTENT_COMPONENTS: ComponentItem[] = [
  {
    type: "table",
    name: "Data Table",
    description: "Interactive transaction list or table",
    icon: TableIcon,
  },
  {
    type: "text",
    name: "Text / Markdown",
    description: "Header, description, or custom notes",
    icon: Type,
  },
  {
    type: "filter-bar",
    name: "Filter Bar",
    description: "Interactive period and category filters",
    icon: SlidersHorizontal,
  },
];

export function ComponentTray({ onAddWidget }: ComponentTrayProps) {
  const handleDragStart = (e: React.DragEvent, type: string) => {
    const defaultNode = WIDGET_DEFAULTS[type];
    if (defaultNode) {
      e.dataTransfer.setData("application/json", JSON.stringify(defaultNode));
      e.dataTransfer.setData("text/plain", type);
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  const renderSection = (title: string, items: ComponentItem[]) => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
        {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              className="group flex items-center justify-between p-2.5 rounded-lg border bg-card/60 hover:bg-accent/40 hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onAddWidget(WIDGET_DEFAULTS[item.type])}
                  title="Add to canvas"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="h-full flex flex-col border shadow-xs overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-muted/20 shrink-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Component Palette
        </CardTitle>
        <CardDescription className="text-[11px]">
          Drag or click <Plus className="inline h-3 w-3 -mt-0.5" /> to add components
        </CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4 pb-2">
          {renderSection("Layouts", LAYOUT_COMPONENTS)}
          {renderSection("Metrics & Visuals", METRIC_COMPONENTS)}
          {renderSection("Data & Controls", CONTENT_COMPONENTS)}
        </div>
      </ScrollArea>
    </Card>
  );
}
