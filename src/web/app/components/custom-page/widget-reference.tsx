import { Search, Copy, Check, LayoutDashboard, Layout, Database } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface DocItem {
  name: string;
  description: string;
  props: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
    options?: string[];
  }>;
  example: object;
}

const BASE_LAYOUT_PROPS = [
  {name: "title", type: "string", description: "Title for the layout"},
  {name: "className", type: "string", description: "Custom CSS class for the layout"},
]
const BASE_WIDGET_PROPS = [
  {name: "title", type: "string", description: "Title for the widget"},
  {name: "className", type: "string", description: "Custom CSS class for the widget"},
]

const LAYOUT_DOCS: Record<string, DocItem> = {
  "stack": {
    name: "Stack Layout",
    description: "Arranges child widgets vertically or horizontally.",
    props: [
      { name: "type", type: "string", description: "Must be 'stack'", required: true },
      { name: "direction", type: "string", description: "Stack direction", options: ["vertical", "horizontal"] },
      { name: "gap", type: "number", description: "Gap between children (0-16)" },
      { name: "children", type: "Array[Widget]", description: "List of widgets to display", required: true },
    ],
    example: {
      type: "stack",
      children: [
        { type: "text", content: "Hello" }
      ]
    }
  },
  "grid": {
    name: "Grid Layout",
    description: "Arranges child widgets in a responsive grid.",
    props: [
      { name: "type", type: "string", description: "Must be 'grid'", required: true },
      { name: "columns", type: "object", description: "Columns per screen size (sm, md, lg)" },
      { name: "children", type: "Array[Widget]", description: "List of widgets to display", required: true },
    ],
    example: {
      type: "grid",
      columns: { sm: 1, md: 2, lg: 3 },
      children: [
        { type: "metric-card", title: "A", query: { type: "balances" } },
        { type: "metric-card", title: "B", query: { type: "balances" } }
      ]
    }
  },
  "tabs": {
    name: "Tabs Layout",
    description: "Displays multiple tabs with content.",
    props: [
      { name: "type", type: "string", description: "Must be 'tabs'", required: true },
      { name: "tabs", type: "Array[Tab]", description: "List of tab items", required: true },
      { name: "Tab.label", type: "string", description: "Tab label", required: true },
      { name: "Tab.value", type: "string", description: "Unique identifier for tab", required: true },
      { name: "Tab.children", type: "Array[Widget]", description: "Content to display for each tab", required: true },
    ],
    example: {
      type: "tabs",
      tabs: [
        { label: "Overview", value: "overview", children: [{ type: "text", content: "Tab 1" }] },
        { label: "Details", value: "details", children: [{ type: "text", content: "Tab 2" }] }
      ]
    }
  }
}

const WIDGET_DOCS: Record<string, DocItem> = {
  "text": {
    name: "Text",
    description: "Displays static text or dynamic content from a query.",
    props: [
      { name: "type", type: "string", description: "Must be 'text'", required: true },
      { name: "content", type: "string", description: "Static text to display" },
      { name: "size", type: "string", description: "Size of the text", options: ["sm", "base", "lg", "xl"] },
      { name: "wrapped", type: "boolean", description: "Wrap text inside a card if true" },
    ],
    example: {
      type: "text",
      content: "Hello, world!",
      size: "lg"
    }
  },
  "metric-card": {
    name: "Metric Card",
    description: "Displays a single value with optional comparison to a previous period.",
    props: [
      { name: "type", type: "string", description: "Must be 'metric-card'", required: true },
      { name: "query", type: "Query", description: "Data source for the value", required: true },
      { name: "label", type: "string", description: "Label for the metric" },
      { name: "format", type: "string", description: "Value formatting", options: ["currency", "number", "percent"] },
    ],
    example: {
      type: "metric-card",
      label: "Total Spent",
      query: { type: "aggregate", metric: "sum", filters: { period: "30d" } },
      format: "currency"
    }
  },
  "chart": {
    name: "Chart",
    description: "Visualizes data using various chart types (line, bar, pie, etc.).",
    props: [
      { name: "type", type: "string", description: "Must be 'chart'", required: true },
      { name: "chartType", type: "string", description: "The type of chart", required: true, options: ["line", "bar", "area", "pie", "donut"] },
      { name: "query", type: "Query", description: "Data source (usually 'trend' or 'aggregate')", required: true },
      { name: "height", type: "number", description: "Height in pixels (default: 300)" },
    ],
    example: {
      type: "chart",
      chartType: "bar",
      query: {
        type: "aggregate",
        groupBy: "category",
        filters: { period: "month" }
      }
    }
  },
  "table": {
    name: "Data Table",
    description: "Displays raw data in a tabular format.",
    props: [
      { name: "type", type: "string", description: "Must be 'table'", required: true },
      { name: "query", type: "Query", description: "Usually 'transactions' query", required: true },
      { name: "columns", type: "Array[Column]", description: "Custom column definitions" },
      { name: "Column.key", type: "string", description: "Column key" },
      { name: "Column.label", type: "string", description: "Column label" },
      { name: "Column.format", type: "string", description: "Value formatting", options: ["currency", "number", "percent", "date", "text"] },
    ],
    example: {
      type: "table",
      query: { type: "transactions", limit: 10 }
    }
  },
  "progress-bar": {
    name: "Progress Bar",
    description: "Displays a progress bar based on a percentage value.",
    props: [
      { name: "type", type: "string", description: "Must be 'progress-bar'", required: true },
      { name: "query", type: "Query", description: "Data source", required: true },
      { name: "target", type: "number", description: "Static target value" },
      { name: "format", type: "string", description: "Formatting", options: ["currency", "number", "percent"] },
    ],
    example: {
      type: "progress-bar",
      format: "number",
      query: { type: "aggregate", metric: "sum" },
      target: 5000
    }
  },
  "comparison": {
    name: "Comparison Chart",
    description: "Compares two data sets side by side.",
    props: [
      { name: "type", type: "string", description: "Must be 'comparison'", required: true },
      { name: "queries", type: "tuple[Query]", description: "Data sources to compare", required: true },
      { name: "labels", type: "tuple[string]", description: "Labels for each data source" },
      { name: "format", type: "string", description: "Value formatting", options: ["currency", "number", "percent"] },
      { name: "higherIsBetter", type: "boolean", description: "Indicates if a higher value is better" },
    ],
    example: {
      type: "comparison",
      title: "Income vs Expense",
      queries: [
        { type: "aggregate", filters: { direction: "income" } },
        { type: "aggregate", filters: { direction: "expense" } }
      ]
    }
  },
  "alert": {
    name: "Alert",
    description: "Displays a notification message when a data threshold is met.",
    props: [
      { name: "type", type: "string", description: "Must be 'alert'", required: true },
      { name: "query", type: "Query", description: "Data source", required: true },
      { name: "threshold", type: "number", description: "Value to compare against", required: true },
      { name: "condition", type: "string", description: "Comparison condition", options: ["above", "below"] },
      { name: "severity", type: "string", description: "Alert severity", options: ["info", "warning", "error"] },
      { name: "message", type: "string", description: "Template: use {{value}} and {{threshold}}", required: true },
    ],
    example: {
      type: "alert",
      title: "Budget Warning",
      message: "You have spent {{value}}, which exceeds your limit of {{threshold}}!",
      query: { type: "aggregate", metric: "sum" },
      condition: "above",
      threshold: 1000,
      severity: "warning"
    }
  },
  "filter-bar": {
    name: "Filter Bar",
    description: "Adds interactive filters that affect all other widgets on the page.",
    props: [
      { name: "type", type: "string", description: "Must be 'filter-bar'", required: true },
      { name: "filters", type: "Array[string]", description: "List of active filters", options: ["dateRange", "category", "provider", "direction"] },
    ],
    example: {
      type: "filter-bar",
      filters: ["dateRange", "category"]
    }
  }
};

const QUERY_DOCS: Record<string, DocItem> = {
  "aggregate": {
    name: "Aggregate Query",
    description: "Calculates sums, averages, or counts across transactions.",
    props: [
      { name: "type", type: "string", description: "Must be 'aggregate'", required: true },
      { name: "filters", type: "Filters", description: "Query filters", required: true },
      { name: "groupBy", type: "string", description: "Group results by field", options: ["category", "merchant", "month", "week", "day", "account"] },
      { name: "metric", type: "string", description: "Math operation", options: ["sum", "avg", "count", "min", "max"] },
      { name: "field", type: "string", description: "Field to aggregate on", options: ["chargedAmount", "originalAmount"] },
      { name: "limit", type: "number", description: "Limit the number of results (1-500)"},
      { name: "sort", type: "string", description: "Sort results by field", options: ["value_desc", "value_asc", "label_asc"]},
      { name: "compareTo", type: "string", description: "Compare to previous period", options: ["previous_period"] },
    ],
    example: {
      type: "aggregate",
      metric: "sum",
      groupBy: "category",
      filters: { period: "30d" }
    }
  },
  "trend": {
    name: "Trend Query",
    description: "Fetches data points over time for line or bar charts.",
    props: [
      { name: "type", type: "string", description: "Must be 'trend'", required: true },
      { name: "interval", type: "string", description: "Time bucket size", options: ["day", "week", "month"] },
      { name: "series", type: "string", description: "Breakdown series", options: ["total", "category", "merchant"] },
      { name: "metric", type: "string", description: "Math operation", options: ["sum", "avg", "count"] },
      { name: "filters", type: "Filters", description: "Query filters" },
    ],
    example: {
      type: "trend",
      interval: "month",
      series: "total"
    }
  },
  "filters": {
    name: "Filters Object",
    description: "Narrow down data by period, category, amount, etc.",
    props: [
      { name: "period", type: "string", description: "Time range (e.g. '30d', '2026-01', 'month')" },
      { name: "category", type: "string[]", description: "List of category names" },
      { name: "merchant", type: "string[]", description: "List of merchant names" },
      { name: "account", type: "string[]", description: "List of account names"},
      { name: "direction", type: "string", description: "Income or expense", options: ["expense", "income", "all"] },
      { name: "amountMin", type: "number", description: "Minimum absolute amount" },
      { name: "amountMax", type: "number", description: "Maximum absolute amount" },
      { name: "type", type: "string", description: "Transaction type", options: ["normal", "installments", "all"]}
    ],
    example: {
      period: "90d",
      direction: "expense",
      category: ["Groceries", "Dining Out"]
    }
  },
  "transactions": {
    name: "Transactions Query",
    description: "Fetches detailed transaction data.",
    props: [
      { name: "type", type: "string", description: "Must be 'transactions'", required: true },
      { name: "filters", type: "Filters", description: "Query filters" },
      { name: "limit", type: "number", description: "Limit the number of results (1-500)"},
      { name: "sort", type: "string", description: "Sort results by field", options: ["date_desc", "date_asc", "amount_desc", "amount_asc"]},
      { name: "offset", type: "number", description: "Skip results (for pagination)" },
    ],
    example: {
      type: "transactions",
      filters: { period: "30d" }
    }
  },
  "balances": {
    name: "Balances Query",
    description: "Fetches account balances for each category.",
    props: [
      { name: "type", type: "string", description: "Must be 'balances'", required: true },
      { name: "account", type: "string", description: "Account name" },
    ],
    example: {
      type: "balances",
      account: "Checking"
    }
  },
  "budget_vs_actual": {
    name: "Budget vs Actual Query",
    description: "Compares budget vs actual spending.",
    props: [
      { name: "type", type: "string", description: "Must be 'budget_vs_actual'", required: true },
      { name: "month", type: "string", description: "Month to compare (YYYY-MM)" },
      { name: "filters", type: "Filters", description: "Query filters"}
    ],
    example: {
      type: "budget_vs_actual",
      month: "2026-01"
    }
  }
};

export function WidgetReference() {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredLayouts = Object.entries(LAYOUT_DOCS).filter(([key, item]) =>
    key.includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredWidgets = Object.entries(WIDGET_DOCS).filter(([key, item]) => 
    key.includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredQueries = Object.entries(QUERY_DOCS).filter(([key, item]) => 
    key.includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase())
  );

  filteredLayouts.forEach(([_k, item]) => {
    if (!item.props.every(prop => prop.name === "title" || prop.name === "className"))
      item.props.push(...BASE_LAYOUT_PROPS)
  });
  filteredWidgets.forEach(([_k, item]) => {
    if (!item.props.every(prop => prop.name === "title" || prop.name === "className"))
      item.props.push(...BASE_WIDGET_PROPS)
  })

  return (
    <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search options..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs defaultValue="widgets" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="layouts" className="flex items-center gap-2">
              <Layout className="h-3.5 w-3.5" /> Layouts
            </TabsTrigger>
            <TabsTrigger value="widgets" className="flex items-center gap-2">
              <LayoutDashboard className="h-3.5 w-3.5" /> Widgets
            </TabsTrigger>
            <TabsTrigger value="queries" className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> Queries
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="layouts" className="m-0 space-y-6 pb-6">
              {filteredLayouts.map(([key, item]) => (
                <DocSection key={key} id={key} item={item} onCopy={handleCopy} copied={copied} />
              ))}
            </TabsContent>

            <TabsContent value="widgets" className="m-0 space-y-6 pb-6">
              {filteredWidgets.map(([key, item]) => (
                <DocSection key={key} id={key} item={item} onCopy={handleCopy} copied={copied} />
              ))}
            </TabsContent>
            
            <TabsContent value="queries" className="m-0 space-y-6 pb-6">
              {filteredQueries.map(([key, item]) => (
                <DocSection key={key} id={key} item={item} onCopy={handleCopy} copied={copied} />
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DocSection({ id, item, onCopy, copied }: { id: string, item: DocItem, onCopy: any, copied: string | null }) {
  const jsonExample = JSON.stringify(item.example, null, 2);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          {item.name} <code className="text-[10px] font-normal opacity-60 bg-muted px-1 rounded">{id}</code>
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={() => onCopy(jsonExample, id)}
        >
          {copied === id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        {item.description}
      </p>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</div>
        <div className="space-y-1.5">
          {item.props.map((prop) => (
            <div key={prop.name} className="text-xs border-l-2 border-muted pl-2 py-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-primary">{prop.name}</span>
                <span className="text-[10px] opacity-60">{prop.type}</span>
                {prop.required && <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0 border-orange-500/50 text-orange-600">Required</Badge>}
              </div>
              <div className="text-muted-foreground mt-0.5">{prop.description}</div>
              {prop.options && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prop.options.map(opt => (
                    <span key={opt} className="text-[9px] bg-muted px-1 rounded font-mono">{opt}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example</div>
        <pre className="text-[10px] bg-muted/40 p-2 rounded border font-mono overflow-x-auto">
          {jsonExample}
        </pre>
      </div>
    </div>
  );
}
