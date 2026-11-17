import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Save,
  Layout,
  Type,
  Info,
  FileCode,
  BookOpen,
  Sparkles,
  Eye,
  Sliders,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCreatePage, useUpdatePage } from "@/hooks/use-custom-pages";
import { WidgetReference } from "@/components/custom-page/widget-reference";
import { CustomPageRenderer } from "@/components/custom-page/custom-page-renderer";
import { validatePage } from "../../../core/page-schema";
import { ICON_MAP, getIcon } from "@/lib/icon-map";

import { ComponentTray } from "@/components/custom-page/builder/component-tray";
import { VisualCanvas } from "@/components/custom-page/builder/visual-canvas";
import { PropertyInspector } from "@/components/custom-page/builder/property-inspector";
import {
  getNode,
  updateNode,
  deleteNode,
  insertChild,
  moveChild,
  duplicateNode,
  isContainer,
  type WidgetNode,
  type Path,
} from "@/components/custom-page/builder/tree-utils";

const TEMPLATES = [
  {
    name: "Blank Stack",
    id: "blank",
    definition: {
      type: "stack",
      direction: "vertical",
      gap: 4,
      children: [],
    },
  },
  {
    name: "Dashboard Overview",
    id: "dashboard",
    icon: "layout-dashboard",
    definition: {
      type: "stack",
      gap: 6,
      children: [
        { type: "filter-bar", filters: ["dateRange", "category"] },
        {
          type: "grid",
          columns: { sm: 1, md: 3 },
          children: [
            {
              type: "metric-card",
              title: "Total Expenses",
              query: { type: "aggregate", metric: "sum", filters: { direction: "expense" } },
              format: "currency",
            },
            {
              type: "metric-card",
              title: "Total Income",
              query: { type: "aggregate", metric: "sum", filters: { direction: "income" } },
              format: "currency",
            },
            {
              type: "metric-card",
              title: "Transactions",
              query: { type: "aggregate", metric: "count" },
              format: "number",
            },
          ],
        },
        {
          type: "chart",
          title: "Spending Trend",
          chartType: "area",
          query: { type: "trend", interval: "day", filters: { direction: "expense" } },
          height: 320,
        },
      ],
    },
  },
  {
    name: "Category Breakdown",
    id: "categories",
    icon: "pie-chart",
    definition: {
      type: "stack",
      gap: 4,
      children: [
        { type: "filter-bar", filters: ["dateRange"] },
        {
          type: "chart",
          chartType: "donut",
          title: "Expenses by Category",
          query: { type: "aggregate", groupBy: "category", filters: { direction: "expense" } },
          height: 320,
        },
        {
          type: "table",
          title: "Recent Transactions",
          query: { type: "transactions", limit: 20 },
        },
      ],
    },
  },
];

export default function CreatePage() {
  const location = useLocation();
  const editingPage = (location.state as any)?.editingPage;
  const isEditing = !!editingPage;

  useDocumentTitle(isEditing ? "Edit Custom Page" : "Create Custom Page");
  const navigate = useNavigate();
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();

  const [activeTab, setActiveTab] = useState<"visual" | "preview" | "code">("visual");

  const [form, setForm] = useState({
    id: editingPage?.id ?? "",
    title: editingPage?.title ?? "",
    icon: editingPage?.icon ?? "layout-dashboard",
    description: editingPage?.description ?? "",
  });

  const [treeState, setTreeState] = useState<WidgetNode>(() => {
    if (editingPage?.definition) {
      return editingPage.definition as WidgetNode;
    }
    return {
      type: "stack",
      direction: "vertical",
      gap: 4,
      children: [
        {
          type: "filter-bar",
          filters: ["dateRange", "category"],
        },
        {
          type: "metric-card",
          title: "Total Expenses",
          query: {
            type: "aggregate",
            metric: "sum",
            filters: { period: "month", direction: "expense" },
          },
          format: "currency",
        },
      ],
    };
  });

  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(treeState, null, 2));
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-slug generator when title changes (if not editing and id was empty or matches previous slug)
  const handleTitleChange = (newTitle: string) => {
    setForm((prev) => {
      const generatedSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return {
        ...prev,
        title: newTitle,
        id: !isEditing && (!prev.id || prev.id === prev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
          ? generatedSlug
          : prev.id,
      };
    });
  };

  // Synchronize tree changes to JSON
  const syncTreeToJSON = (nextTree: WidgetNode) => {
    setTreeState(nextTree);
    setJsonText(JSON.stringify(nextTree, null, 2));
  };

  // Synchronize JSON changes to tree
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.type) {
        setTreeState(parsed);
      }
    } catch {
      // JSON is currently invalid/incomplete while typing
    }
  };

  // Live schema validation
  const validationResult = useMemo(() => {
    try {
      const parsedDef = JSON.parse(jsonText);
      return validatePage({
        id: form.id || "temp-id",
        title: form.title || "Temp Title",
        icon: form.icon,
        description: form.description,
        definition: parsedDef,
      });
    } catch (err: any) {
      return { success: false, error: `Invalid JSON syntax: ${err.message}` };
    }
  }, [form, jsonText]);

  // Selected node retrieval
  const selectedNode = useMemo(() => {
    if (!selectedPath) return null;
    return getNode(treeState, selectedPath) || null;
  }, [treeState, selectedPath]);

  // Adding widget from palette
  const handleAddWidget = (widgetTemplate: WidgetNode) => {
    if (!selectedPath || selectedPath.length === 0) {
      // Add to root container
      if (isContainer(treeState)) {
        const next = insertChild(treeState, [], -1, widgetTemplate);
        syncTreeToJSON(next);
      }
      return;
    }

    const currentSelected = getNode(treeState, selectedPath);
    if (isContainer(currentSelected)) {
      // Add as child to selected container
      const next = insertChild(treeState, selectedPath, -1, widgetTemplate);
      syncTreeToJSON(next);
    } else {
      // Add as sibling right after current selected node
      const parentPath = selectedPath.slice(0, -1);
      const lastKey = selectedPath[selectedPath.length - 1];
      if (typeof lastKey === "number") {
        const next = insertChild(treeState, parentPath, lastKey + 1, widgetTemplate);
        syncTreeToJSON(next);
      } else {
        const next = insertChild(treeState, [], -1, widgetTemplate);
        syncTreeToJSON(next);
      }
    }
  };

  const handleUpdateNode = (path: Path, updates: Partial<WidgetNode>) => {
    const next = updateNode(treeState, path, () => updates);
    syncTreeToJSON(next);
  };

  const handleDeleteNode = (path: Path) => {
    if (path.length === 0) return;

    const next = deleteNode(treeState, path);
    setSelectedPath(null);
    syncTreeToJSON(next);
  };

  const handleInsertChild = (containerPath: Path, index: number, newNode: WidgetNode) => {
    const next = insertChild(treeState, containerPath, index, newNode);
    syncTreeToJSON(next);
  };

  const handleMoveChild = (containerPath: Path, fromIndex: number, toIndex: number) => {
    const next = moveChild(treeState, containerPath, fromIndex, toIndex);
    syncTreeToJSON(next);
  };

  const handleDuplicateNode = (path: Path) => {
    const next = duplicateNode(treeState, path);
    syncTreeToJSON(next);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      syncTreeToJSON(template.definition as WidgetNode);
      setSelectedPath(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.id || !form.title) {
      setError("Page ID (slug) and Title are required.");
      return;
    }

    let parsedDef: unknown;
    try {
      parsedDef = JSON.parse(jsonText);
    } catch {
      setError("Page definition contains invalid JSON syntax.");
      return;
    }

    const response = validatePage({
      id: form.id,
      title: form.title,
      icon: form.icon,
      description: form.description,
      definition: parsedDef,
    });

    if (!response.success) {
      setError(response.error || "Failed to validate page schema.");
      return;
    }

    try {
      if (isEditing) {
        // @ts-ignore
        await updatePage.mutateAsync(response.data);
        navigate(`/pages/${form.id}`);
      } else {
        // @ts-ignore
        await createPage.mutateAsync(response.data);
        navigate(`/pages/${form.id}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save page.");
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <PageHeader
          title={isEditing ? "Edit Custom Page" : "Create Custom Page"}
          description={
            isEditing
              ? "Modify your interactive dashboard layout and query widgets."
              : "Design custom visual dashboards with interactive drag-and-drop widgets and queries."
          }
        />

        <div className="flex items-center gap-2">
          {!isEditing && (
            <div className="flex items-center gap-2 mr-2">
              <Label htmlFor="template" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Template:
              </Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger id="template" className="w-[160px] h-8 text-xs bg-background">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode Switcher */}
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
            <TabsList className="h-8 p-0.5 bg-muted/80">
              <TabsTrigger value="visual" className="text-xs h-7 px-3 gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>Visual Builder</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs h-7 px-3 gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>Live Preview</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs h-7 px-3 gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-primary" />
                <span>JSON Code</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Workspace Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-3">
        {/* Error / Validation Banner */}
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Page Metadata Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-xl border bg-card shadow-xs shrink-0">
          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="id" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layout className="h-3 w-3" /> Page Slug (ID)
            </Label>
            <Input
              id="id"
              placeholder="e.g. monthly-overview"
              className="h-8 text-xs bg-background"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              disabled={isEditing}
            />
          </div>

          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="title" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Type className="h-3 w-3" /> Page Title
            </Label>
            <Input
              id="title"
              placeholder="e.g. Monthly Overview"
              className="h-8 text-xs bg-background"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="icon" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Icon
            </Label>
            <Select value={form.icon} onValueChange={(val) => setForm({ ...form, icon: val })}>
              <SelectTrigger id="icon" className="h-8 text-xs bg-background">
                <SelectValue placeholder="Icon..." />
              </SelectTrigger>
              <SelectContent className="max-h-[220px]">
                {Object.keys(ICON_MAP).map((iconName) => {
                  const Icon = getIcon(iconName);
                  return (
                      <SelectItem key={iconName} value={iconName}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 transition-colors duration-150" />
                          <span>{iconName}</span>
                        </span>
                      </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4 space-y-1">
            <Label htmlFor="description" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3 w-3" /> Description (optional)
            </Label>
            <Input
              id="description"
              placeholder="Brief description of this dashboard..."
              className="h-8 text-xs bg-background"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        {/* Workspace Body depending on Active Tab */}
        <div className="flex-1 min-h-0">
          {/* 1. Visual Builder Mode */}
          {activeTab === "visual" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-270px)] min-h-[420px]">
              {/* Left Panel: Component Palette */}
              <div className="lg:col-span-3 h-full min-h-0">
                <ComponentTray onAddWidget={handleAddWidget} />
              </div>

              {/* Middle Panel: Visual Canvas */}
              <div className="lg:col-span-5 h-full min-h-0">
                <VisualCanvas
                  rootNode={treeState}
                  selectedPath={selectedPath}
                  onSelectPath={setSelectedPath}
                  onInsertChild={handleInsertChild}
                  onMoveChild={handleMoveChild}
                  onDuplicateNode={handleDuplicateNode}
                  onDeleteNode={handleDeleteNode}
                />
              </div>

              {/* Right Panel: Property & Query Inspector */}
              <div className="lg:col-span-4 h-full min-h-0">
                <PropertyInspector
                  selectedPath={selectedPath}
                  selectedNode={selectedNode}
                  onUpdateNode={handleUpdateNode}
                  onDeleteNode={handleDeleteNode}
                />
              </div>
            </div>
          )}

          {/* 2. Live Preview Mode */}
          {activeTab === "preview" && (
            <div className="h-[calc(100vh-270px)] min-h-[420px] rounded-xl border bg-card p-6 shadow-xs overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Live Dashboard Preview
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Interactive real-time data & filters
                </Badge>
              </div>

              <div className="pt-2">
                <CustomPageRenderer pageId={form.id || "preview-page"} definition={treeState} />
              </div>
            </div>
          )}

          {/* 3. JSON Code Editor Mode */}
          {activeTab === "code" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-270px)] min-h-[420px]">
              <div className="lg:col-span-7 flex flex-col rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    <Label htmlFor="json-editor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Raw JSON Definition
                    </Label>
                  </div>
                  {validationResult.success ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Valid Schema
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10 flex items-center gap-1 truncate max-w-[280px]">
                      <AlertCircle className="h-3 w-3 shrink-0" /> Invalid Schema
                    </Badge>
                  )}
                </div>

                <textarea
                  id="json-editor"
                  className="flex-1 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring transition-colors resize-none"
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col rounded-xl border bg-card shadow-xs overflow-hidden">
                <div className="p-3 border-b bg-muted/10 flex items-center gap-2 shrink-0">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Widget Reference & Documentation
                  </h2>
                </div>
                <div className="p-3 flex-1 overflow-y-auto">
                  <WidgetReference />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <div className="flex items-center gap-2">
            {validationResult.success ? (
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Schema is valid and ready
              </span>
            ) : (
              <span className="text-[11px] text-destructive flex items-center gap-1 font-medium truncate max-w-[400px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {validationResult.error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createPage.isPending || updatePage.isPending || !validationResult.success}
              className="gap-1.5"
            >
              {createPage.isPending || updatePage.isPending ? (
                isEditing ? "Updating..." : "Creating..."
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {isEditing ? "Update Page" : "Create Page"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
