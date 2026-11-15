import { describe, it, expect } from "vitest";
import {
  getNode,
  setNode,
  updateNode,
  deleteNode,
  insertChild,
  moveChild,
  duplicateNode,
  isContainer,
  type WidgetNode,
} from "../../src/web/app/components/custom-page/builder/tree-utils";

describe("Visual Page Builder Tree Utilities", () => {
  const sampleTree: WidgetNode = {
    type: "stack",
    direction: "vertical",
    gap: 4,
    children: [
      {
        type: "metric-card",
        title: "Total Expenses",
        query: { type: "aggregate", metric: "sum" },
      },
      {
        type: "grid",
        columns: { sm: 1, md: 2, lg: 3 },
        children: [
          { type: "chart", title: "Trend Chart", chartType: "line", query: { type: "trend" } },
          { type: "text", content: "Notes" },
        ],
      },
    ],
  };

  it("retrieves node at root and at nested paths", () => {
    expect(getNode(sampleTree, [])).toBe(sampleTree);

    const firstChild = getNode(sampleTree, ["children", 0]);
    expect(firstChild?.type).toBe("metric-card");
    expect(firstChild?.title).toBe("Total Expenses");

    const nestedChild = getNode(sampleTree, ["children", 1, "children", 0]);
    expect(nestedChild?.type).toBe("chart");
    expect(nestedChild?.title).toBe("Trend Chart");
  });

  it("updates node properties immutably", () => {
    const updated = updateNode(sampleTree, ["children", 0], (prev) => ({
      title: "Updated Title",
      format: "currency",
    }));

    expect(getNode(updated, ["children", 0])?.title).toBe("Updated Title");
    expect(getNode(updated, ["children", 0])?.format).toBe("currency");
    // Original remains untouched
    expect(getNode(sampleTree, ["children", 0])?.title).toBe("Total Expenses");
  });

  it("inserts new widgets into container nodes", () => {
    const newWidget: WidgetNode = {
      type: "alert",
      title: "Budget Alert",
      threshold: 500,
      condition: "above",
      message: "Warning",
    };

    const inserted = insertChild(sampleTree, ["children", 1], 1, newWidget);
    const gridNode = getNode(inserted, ["children", 1]);
    expect(gridNode?.children?.length).toBe(3);
    expect(gridNode?.children?.[1]?.type).toBe("alert");
  });

  it("moves children to reorder them within a container", () => {
    const moved = moveChild(sampleTree, ["children", 1], 0, 1);
    const gridNode = getNode(moved, ["children", 1]);
    expect(gridNode?.children?.[0]?.type).toBe("text");
    expect(gridNode?.children?.[1]?.type).toBe("chart");
  });

  it("duplicates nodes at specific paths", () => {
    const duplicated = duplicateNode(sampleTree, ["children", 0]);
    expect(duplicated.children?.length).toBe(3);
    expect(duplicated.children?.[0]?.title).toBe("Total Expenses");
    expect(duplicated.children?.[1]?.title).toBe("Total Expenses");
  });

  it("deletes a node at given path", () => {
    const deleted = deleteNode(sampleTree, ["children", 0]);
    expect(deleted.children?.length).toBe(1);
    expect(deleted.children?.[0]?.type).toBe("grid");
  });

  it("identifies container nodes correctly", () => {
    expect(isContainer({ type: "stack" })).toBe(true);
    expect(isContainer({ type: "grid" })).toBe(true);
    expect(isContainer({ type: "tabs" })).toBe(true);
    expect(isContainer({ type: "metric-card" })).toBe(false);
    expect(isContainer({ type: "chart" })).toBe(false);
  });
});
