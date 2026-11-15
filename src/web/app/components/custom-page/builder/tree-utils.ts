export type Path = Array<string | number>;

export interface WidgetNode {
  type: string;
  title?: string;
  className?: string;
  children?: WidgetNode[];
  tabs?: Array<{
    label: string;
    value: string;
    children: WidgetNode[];
  }>;
  [key: string]: unknown;
}

export const WIDGET_DEFAULTS: Record<string, WidgetNode> = {
  "stack": {
    type: "stack",
    direction: "vertical",
    gap: 4,
    children: [],
  },
  "grid": {
    type: "grid",
    columns: { sm: 1, md: 2, lg: 3 },
    children: [],
  },
  "tabs": {
    type: "tabs",
    tabs: [
      { label: "Overview", value: "overview", children: [] },
      { label: "Details", value: "details", children: [] },
    ],
  },
  "metric-card": {
    type: "metric-card",
    title: "Total Expenses",
    format: "currency",
    query: {
      type: "aggregate",
      metric: "sum",
      filters: { direction: "expense", period: "month" },
    },
  },
  "chart": {
    type: "chart",
    title: "Spending by Category",
    chartType: "donut",
    height: 300,
    query: {
      type: "aggregate",
      groupBy: "category",
      metric: "sum",
      filters: { direction: "expense" },
    },
  },
  "table": {
    type: "table",
    title: "Recent Transactions",
    query: {
      type: "transactions",
      limit: 10,
      sort: "date_desc",
    },
  },
  "progress-bar": {
    type: "progress-bar",
    title: "Monthly Budget",
    target: 5000,
    format: "currency",
    query: {
      type: "aggregate",
      metric: "sum",
      filters: { direction: "expense", period: "month" },
    },
  },
  "comparison": {
    type: "comparison",
    title: "Income vs. Expenses",
    format: "currency",
    labels: ["Income", "Expenses"],
    higherIsBetter: true,
    queries: [
      { type: "aggregate", metric: "sum", filters: { direction: "income", period: "month" } },
      { type: "aggregate", metric: "sum", filters: { direction: "expense", period: "month" } },
    ],
  },
  "alert": {
    type: "alert",
    title: "High Spending Alert",
    threshold: 10000,
    condition: "above",
    message: "Monthly spending has exceeded ₪10,000 threshold!",
    severity: "warning",
    query: {
      type: "aggregate",
      metric: "sum",
      filters: { direction: "expense", period: "month" },
    },
  },
  "text": {
    type: "text",
    content: "### Welcome to your dashboard\nCustomize this section with markdown text or key notes.",
    size: "base",
    wrapped: true,
  },
  "filter-bar": {
    type: "filter-bar",
    filters: ["dateRange", "category"],
  },
};

export function pathToString(path: Path): string {
  return path.join(".");
}

export function stringToPath(str: string): Path {
  if (!str) return [];
  return str.split(".").map((seg) => (isNaN(Number(seg)) ? seg : Number(seg)));
}

export function getNode(root: WidgetNode, path: Path): WidgetNode | undefined {
  if (path.length === 0) return root;
  let curr: unknown = root;
  for (const seg of path) {
    if (!curr || typeof curr !== "object") return undefined;
    curr = (curr as Record<string, unknown>)[seg];
  }
  return curr as WidgetNode | undefined;
}

export function setNode(root: WidgetNode, path: Path, updated: WidgetNode): WidgetNode {
  if (path.length === 0) return updated;

  const clone = structuredClone(root);
  let curr: unknown = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    curr = (curr as Record<string, unknown>)[seg];
    if (!curr || typeof curr !== "object") return root;
  }
  const lastSeg = path[path.length - 1];
  (curr as Record<string, unknown>)[lastSeg] = updated;
  return clone;
}

export function updateNode(
  root: WidgetNode,
  path: Path,
  updater: (prev: WidgetNode) => WidgetNode | Partial<WidgetNode>,
): WidgetNode {
  const current = getNode(root, path);
  if (!current) return root;
  const result = updater(current);
  const nextNode = { ...current, ...result } as WidgetNode;
  return setNode(root, path, nextNode);
}

export function deleteNode(root: WidgetNode, path: Path): WidgetNode {
  if (path.length === 0) {
    return root;
  }

  const clone = structuredClone(root);
  const parentPath = path.slice(0, -1);
  const lastKey = path[path.length - 1];

  let parent: unknown = clone;
  for (const seg of parentPath) {
    parent = (parent as Record<string, unknown>)[seg];
    if (!parent) return root;
  }

  if (Array.isArray(parent) && typeof lastKey === "number") {
    parent.splice(lastKey, 1);
  } else if (parent && typeof parent === "object") {
    delete (parent as Record<string, unknown>)[lastKey];
  }

  return clone;
}

export function insertChild(
  root: WidgetNode,
  containerPath: Path,
  index: number,
  newNode: WidgetNode,
): WidgetNode {
  const clone = structuredClone(root);
  let container: unknown = clone;
  for (const seg of containerPath) {
    container = (container as Record<string, unknown>)[seg];
    if (!container) return root;
  }

  const cObj = container as Record<string, unknown>;
  if (Array.isArray(cObj.children)) {
    const targetIdx = index < 0 ? cObj.children.length : Math.min(index, cObj.children.length);
    cObj.children.splice(targetIdx, 0, structuredClone(newNode));
  } else {
    cObj.children = [structuredClone(newNode)];
  }

  return clone;
}

export function moveChild(
  root: WidgetNode,
  containerPath: Path,
  fromIndex: number,
  toIndex: number,
): WidgetNode {
  const clone = structuredClone(root);
  let container: unknown = clone;
  for (const seg of containerPath) {
    container = (container as Record<string, unknown>)[seg];
    if (!container) return root;
  }

  const cObj = container as Record<string, unknown>;
  if (!Array.isArray(cObj.children)) return root;

  if (fromIndex < 0 || fromIndex >= cObj.children.length) return root;
  if (toIndex < 0 || toIndex >= cObj.children.length) return root;

  const [item] = cObj.children.splice(fromIndex, 1);
  cObj.children.splice(toIndex, 0, item);

  return clone;
}

export function duplicateNode(root: WidgetNode, path: Path): WidgetNode {
  if (path.length === 0) return root;
  const target = getNode(root, path);
  if (!target) return root;

  const lastKey = path[path.length - 1];
  const parentPath = path.slice(0, -1);

  if (typeof lastKey === "number") {
    const clone = structuredClone(root);
    let parent: unknown = clone;
    for (const seg of parentPath) {
      parent = (parent as Record<string, unknown>)[seg];
    }
    if (Array.isArray(parent)) {
      parent.splice(lastKey + 1, 0, structuredClone(target));
      return clone;
    }
  }

  return root;
}

export function isContainer(widget: WidgetNode | undefined): boolean {
  if (!widget) return false;
  return widget.type === "stack" || widget.type === "grid" || widget.type === "tabs";
}
