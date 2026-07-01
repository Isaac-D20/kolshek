import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Save, Layout, Type, Info, FileCode, BookOpen, Sparkles } from "lucide-react";
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
import { useCreatePage, useUpdatePage } from "@/hooks/use-custom-pages";
import { WidgetReference } from "@/components/custom-page/widget-reference";
import { validatePage } from "../../../core/page-schema";
import { ICON_MAP } from "@/lib/icon-map";

const TEMPLATES = [
  {
    name: "Blank Stack",
    id: "blank",
    definition: {
        type: "stack",
        children: []
      }
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
                format: "currency"
              },
              {
                type: "metric-card",
                title: "Income",
                query: { type: "aggregate", metric: "sum", filters: { direction: "income" } },
                format: "currency"
              },
              {
                type: "metric-card",
                title: "Transaction Count",
                query: { type: "aggregate", metric: "count" }
              }
            ]
          },
          {
            type: "chart",
            title: "Spending Trend",
            chartType: "area",
            query: { type: "trend", interval: "day", filters: { direction: "expense" } }
          }
        ]
      }
  },
  {
    name: "Category Breakdown",
    id: "categories",
    icon: "pie-chart",
    definition: {
      type: "stack",
        children: [
          { type: "filter-bar", filters: ["dateRange"] },
          {
            type: "chart",
            chartType: "donut",
            title: "Expenses by Category",
            query: { type: "aggregate", groupBy: "category", filters: { direction: "expense" } }
          },
          {
            type: "table",
            title: "Recent Transactions",
            query: { type: "transactions", limit: 20 }
          }
        ]
      }
  }
];

export default function CreatePage() {
  const location = useLocation();
  const editingPage = (location.state as any)?.editingPage;
  const isEditing = !!editingPage;

  useDocumentTitle(isEditing ? "Edit Custom Page" : "Create Custom Page");
  const navigate = useNavigate();
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();

  const [form, setForm] = useState({
    id: editingPage?.id ?? "",
    title: editingPage?.title ?? "",
    icon: editingPage?.icon ?? "layout-dashboard",
    description: editingPage?.description ?? "",
    definition: editingPage
      ? JSON.stringify(editingPage.definition, null, 2)
      : JSON.stringify({
          type: "stack",
          children: [
            {
              type: "metric-card",
              query: {
                type: "aggregate",
                metric: "sum",
                filters: { period: "30d" }
              }
            }
          ]
        }, null, 2)
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.id || !form.title) {
      setError("ID and Title are required");
      return;
    }

    let response = validatePage({
      id: form.id,
      title: form.title,
      icon: form.icon,
      description: form.description,
      definition: JSON.parse(form.definition)
    });
    if (!response.success) {
      setError(response.error || "Failed to save page");
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
      setError(err.message || "Failed to save page");
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setForm(prev => ({
        ...prev,
        definition: JSON.stringify(template.definition, null, 2)
      }));
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <PageHeader
          title={isEditing ? "Edit Custom Page" : "Create Custom Page"}
          description={isEditing ? "Update your dashboard page definition." : "Define a new dashboard page using JSON widgets."}
        />
        {!isEditing && (
          <div className="flex items-center gap-3">
            <Label htmlFor="template" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Quick Template
            </Label>
            <Select onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template" className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5 flex-col rounded-xl border p-6 bg-card shadow-sm h-[calc(100vh-108px)] overflow-y-auto">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Layout className="h-3.5 w-3.5" /> Page ID (slug)
              </Label>
              <Input
                id="id"
                placeholder="my-custom-page"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Type className="h-3.5 w-3.5" /> Title
              </Label>
              <Input
                id="title"
                placeholder="Monthly Overview"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Icon</Label>
              <Select value={form.icon} onValueChange={(value) => setForm({ ...form, icon: value })}>
                <SelectTrigger id="icon">
                  <SelectValue placeholder="Select an icon..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(ICON_MAP).map((iconName) => (
                    <SelectItem key={iconName} value={iconName}>
                      {iconName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Description (optional)
              </Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2 flex flex-col flex-1">
            <Label htmlFor="definition" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileCode className="h-3.5 w-3.5" /> JSON Definition
            </Label>
            <textarea
              id="definition"
              className="min-h-[300px] rounded-md border border-input bg-muted/20 px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPage.isPending || updatePage.isPending}>
              {createPage.isPending || updatePage.isPending ? (
                isEditing ? "Updating..." : "Creating..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? "Update Page" : "Create Page"}
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="lg:col-span-5 flex flex-col min-h-0 overflow-y-auto">
          <div className="rounded-xl border bg-card shadow-sm flex-col overflow-y-auto h-[calc(100vh-108px)]">
            <div className="p-4 border-b bg-muted/10 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Documentation & Reference</h2>
            </div>
            <div className="p-4 flex-1 overflow-hidden">
              <WidgetReference />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
