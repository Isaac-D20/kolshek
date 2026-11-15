import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropertyInspector } from "../../src/web/app/components/custom-page/builder/property-inspector";
import { VisualCanvas } from "../../src/web/app/components/custom-page/builder/visual-canvas";
import type { Path, WidgetNode } from "../../src/web/app/components/custom-page/builder/tree-utils";

const rootNode: WidgetNode = {
  type: "stack",
  direction: "vertical",
  children: [{ type: "text", content: "Notes" }],
};

function renderCanvas(selectedPath: Path | null) {
  return renderToStaticMarkup(createElement(VisualCanvas, {
    rootNode,
    selectedPath,
    onSelectPath: () => {},
    onInsertChild: () => {},
    onMoveChild: () => {},
    onDuplicateNode: () => {},
    onDeleteNode: () => {},
  }));
}

describe("page builder component root safeguards", () => {
  it("keeps the root editable without offering root deletion", () => {
    const markup = renderToStaticMarkup(createElement(PropertyInspector, {
      selectedPath: [],
      selectedNode: rootNode,
      onUpdateNode: () => {},
      onDeleteNode: () => {},
    }));

    expect(markup).toContain('id="prop-title"');
    expect(markup).not.toContain('title="Delete this component"');
  });

  it("offers deletion for a selected child", () => {
    const markup = renderToStaticMarkup(createElement(PropertyInspector, {
      selectedPath: ["children", 0],
      selectedNode: rootNode.children![0],
      onUpdateNode: () => {},
      onDeleteNode: () => {},
    }));

    expect(markup).toContain('title="Delete this component"');
  });

  it("distinguishes no selection from explicit root selection and keeps child actions", () => {
    const unselectedMarkup = renderCanvas(null);
    const rootSelectedMarkup = renderCanvas([]);

    expect(unselectedMarkup).not.toContain("border-primary ring-2 ring-primary/20");
    expect(rootSelectedMarkup).toContain("border-primary ring-2 ring-primary/20");
    expect(unselectedMarkup.match(/title="Delete"/g)).toHaveLength(1);
  });
});