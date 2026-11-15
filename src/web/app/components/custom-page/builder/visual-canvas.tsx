import React, { useState } from "react";
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
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
  Move,
  CornerDownRight,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  pathToString,
  type Path,
  type WidgetNode,
} from "./tree-utils";

interface VisualCanvasProps {
  rootNode: WidgetNode;
  selectedPath: Path | null;
  onSelectPath: (path: Path) => void;
  onInsertChild: (containerPath: Path, index: number, newNode: WidgetNode) => void;
  onMoveChild: (containerPath: Path, fromIndex: number, toIndex: number) => void;
  onDuplicateNode: (path: Path) => void;
  onDeleteNode: (path: Path) => void;
}

const ICON_BY_TYPE: Record<string, React.ComponentType<{ className?: string }>> = {
  "stack": Layers,
  "grid": LayoutGrid,
  "tabs": FolderKanban,
  "metric-card": Hash,
  "chart": BarChart3,
  "table": TableIcon,
  "progress-bar": Percent,
  "comparison": GitCompare,
  "alert": AlertTriangle,
  "text": Type,
  "filter-bar": SlidersHorizontal,
};

export function VisualCanvas({
  rootNode,
  selectedPath,
  onSelectPath,
  onInsertChild,
  onMoveChild,
  onDuplicateNode,
  onDeleteNode,
}: VisualCanvasProps) {
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const selectedPathStr = selectedPath === null ? null : pathToString(selectedPath);

  const handleDrop = (e: React.DragEvent, containerPath: Path, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (rawData) {
        const newNode = JSON.parse(rawData) as WidgetNode;
        onInsertChild(containerPath, index, newNode);
      }
    } catch (err) {
      console.error("Failed to parse dropped widget", err);
    }
  };

  const handleDragOver = (e: React.DragEvent, dropKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (dragOverPath !== dropKey) {
      setDragOverPath(dropKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
  };

  const renderDropZone = (containerPath: Path, index: number, label = "Drop or click to add") => {
    const dropKey = `${pathToString(containerPath)}:idx:${index}`;
    const isOver = dragOverPath === dropKey;

    return (
      <div
        onDragOver={(e) => handleDragOver(e, dropKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, containerPath, index)}
        className={`group/drop flex items-center justify-center p-2 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
          isOver
            ? "border-primary bg-primary/10 text-primary scale-[1.01]"
            : "border-border/60 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground/70"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPath(containerPath);
        }}
      >
        <span className="text-[11px] font-medium flex items-center gap-1.5">
          <Plus className="h-3 w-3" />
          {label}
        </span>
      </div>
    );
  };

  const renderNode = (
    node: WidgetNode,
    currentPath: Path,
    indexInParent?: number,
    parentPath?: Path,
    totalSiblings?: number,
  ): React.ReactNode => {
    const pathStr = pathToString(currentPath);
    const isSelected = selectedPathStr !== null && selectedPathStr === pathStr;
    const Icon = ICON_BY_TYPE[node.type] || Layers;
    const isLayout = node.type === "stack" || node.type === "grid" || node.type === "tabs";

    return (
      <div
        key={pathStr || "root"}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPath(currentPath);
        }}
        className={`relative rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? "border-primary ring-2 ring-primary/20 bg-card shadow-md"
            : "border-border bg-card/80 hover:border-primary/40 shadow-xs"
        } ${isLayout ? "p-3 space-y-3" : "p-3"}`}
      >
        {/* Node Header / Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`p-1.5 rounded-md shrink-0 transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold leading-tight text-foreground truncate">
                  {node.title || node.type}
                </span>
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 uppercase">
                  {node.type}
                </Badge>
              </div>
              {node.query && typeof node.query === "object" && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <Database className="h-2.5 w-2.5 text-primary/70" />
                  <span>
                    {(node.query as Record<string, string>).type}
                    {(node.query as Record<string, string>).metric ? ` (${(node.query as Record<string, string>).metric})` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons (Move Up, Move Down, Duplicate, Delete) */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {parentPath !== undefined && indexInParent !== undefined && totalSiblings !== undefined && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  disabled={indexInParent <= 0}
                  onClick={() => onMoveChild(parentPath, indexInParent, indexInParent - 1)}
                  title="Move Up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  disabled={indexInParent >= totalSiblings - 1}
                  onClick={() => onMoveChild(parentPath, indexInParent, indexInParent + 1)}
                  title="Move Down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onDuplicateNode(currentPath)}
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteNode(currentPath)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stack Children */}
        {node.type === "stack" && (
          <div className="pt-2 pl-2 border-l-2 border-muted/80 space-y-2 mt-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium pb-1">
              <CornerDownRight className="h-3 w-3" />
              <span>Stack ({node.direction || "vertical"}, gap: {node.gap ?? 4})</span>
            </div>
            {Array.isArray(node.children) && node.children.length > 0 ? (
              <div className="space-y-2">
                {node.children.map((child, idx) =>
                  renderNode(
                    child,
                    [...currentPath, "children", idx],
                    idx,
                    [...currentPath],
                    node.children!.length,
                  ),
                )}
                {renderDropZone([...currentPath], node.children.length, "Add to Stack")}
              </div>
            ) : (
              renderDropZone([...currentPath], 0, "Empty Stack — Drop or click to add children")
            )}
          </div>
        )}

        {/* Grid Children */}
        {node.type === "grid" && (
          <div className="pt-2 pl-2 border-l-2 border-muted/80 space-y-2 mt-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium pb-1">
              <CornerDownRight className="h-3 w-3" />
              <span>
                Grid (cols: sm {((node.columns as Record<string, number>)?.sm ?? 1)}, md {((node.columns as Record<string, number>)?.md ?? 2)}, lg {((node.columns as Record<string, number>)?.lg ?? 3)})
              </span>
            </div>
            {Array.isArray(node.children) && node.children.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {node.children.map((child, idx) =>
                    renderNode(
                      child,
                      [...currentPath, "children", idx],
                      idx,
                      [...currentPath],
                      node.children!.length,
                    ),
                  )}
                </div>
                {renderDropZone([...currentPath], node.children.length, "Add to Grid")}
              </div>
            ) : (
              renderDropZone([...currentPath], 0, "Empty Grid — Drop or click to add children")
            )}
          </div>
        )}

        {/* Tabs Children */}
        {node.type === "tabs" && Array.isArray(node.tabs) && (
          <div className="pt-2 pl-2 border-l-2 border-muted/80 space-y-2 mt-1">
            {node.tabs.length > 0 && (
              <Tabs
                value={activeTabs[pathStr] || node.tabs[0]?.value}
                onValueChange={(val) => setActiveTabs((prev) => ({ ...prev, [pathStr]: val }))}
              >
                <TabsList className="h-7 p-0.5 bg-muted/60">
                  {node.tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} className="text-xs h-6 px-2.5">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {node.tabs.map((tab, tabIdx) => {
                  const isActive = (activeTabs[pathStr] || node.tabs![0]?.value) === tab.value;
                  if (!isActive) return null;

                  const tabPath: Path = [...currentPath, "tabs", tabIdx];
                  return (
                    <div key={tab.value} className="pt-2 space-y-2">
                      {Array.isArray(tab.children) && tab.children.length > 0 ? (
                        <div className="space-y-2">
                          {tab.children.map((child, idx) =>
                            renderNode(
                              child,
                              [...tabPath, "children", idx],
                              idx,
                              tabPath,
                              tab.children.length,
                            ),
                          )}
                          {renderDropZone(tabPath, tab.children.length, `Add to ${tab.label}`)}
                        </div>
                      ) : (
                        renderDropZone(tabPath, 0, `Empty ${tab.label} — Drop or click to add widgets`)
                      )}
                    </div>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col rounded-xl border bg-muted/10 p-4 overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Visual Page Canvas
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Click component to inspect • Reorder with arrows
        </span>
      </div>

      <ScrollArea className="flex-1 pt-3 pr-2">
        <div className="space-y-3 pb-6">
          {renderNode(rootNode, [])}
        </div>
      </ScrollArea>
    </div>
  );
}
