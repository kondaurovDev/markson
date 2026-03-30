/**
 * @module update
 *
 * Write engine — walks a schema + patch to locate and mutate AST nodes.
 * After mutation, the AST can be serialized back to markdown via `remark.stringify()`.
 */

import type { Root, RootContent, Heading, List, ListItem, Paragraph, Strong, Text } from "mdast";
import type { Selector, SchemaShape } from "./schema";
import { isSelector } from "./schema";
import { collectChildHeadings, inlineToText, isFieldParagraph } from "./section";

/** Applies a partial patch to the AST tree, guided by the schema. Mutates the tree in place. */
export function executeUpdateOnTree(tree: Root, schema: SchemaShape, patch: Record<string, any>) {
  const firstHeading = tree.children.find((n): n is Heading => n.type === "heading");
  if (!firstHeading) return;

  const headingIndex = tree.children.indexOf(firstHeading);
  const contentRange = getContentRange(tree.children, headingIndex, firstHeading.depth);

  for (const [key, selector] of Object.entries(schema)) {
    if (!(key in patch)) continue;
    updateSelector(tree.children, headingIndex, firstHeading.depth, contentRange, selector, patch[key], tree);
  }
}

function getContentRange(nodes: RootContent[], headingIndex: number, depth: number): { start: number; end: number } {
  const start = headingIndex + 1;
  let end = nodes.length;
  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "heading" && (node as Heading).depth <= depth) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function updateSelector(
  allNodes: RootContent[],
  headingIndex: number,
  depth: number,
  contentRange: { start: number; end: number },
  sel: Selector,
  value: any,
  tree: Root,
) {
  const s = sel as any;
  switch (s._tag) {
    case "title": {
      const heading = allNodes[headingIndex] as Heading;
      heading.children = [{ type: "text", value: String(value) } as Text];
      break;
    }
    case "field": {
      updateField(allNodes, contentRange, s.key, String(value));
      break;
    }
    case "list": {
      updateList(allNodes, contentRange, value as string[]);
      break;
    }
    case "tasks": {
      updateTasks(allNodes, contentRange, value as { text: string; checked: boolean }[]);
      break;
    }
    case "frontmatter": {
      const fmIndex = tree.children.findIndex((n) => n.type === "yaml");
      const yamlStr = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");
      if (fmIndex >= 0) {
        (tree.children[fmIndex] as any).value = yamlStr;
      } else {
        tree.children.unshift({ type: "yaml", value: yamlStr } as any);
      }
      break;
    }
    case "text": {
      updateText(allNodes, contentRange, String(value));
      break;
    }
    case "section": {
      const childHeadings = collectChildHeadings(allNodes, headingIndex, depth);
      const lower = s.name.toLowerCase();
      const ch = childHeadings.find((h) => h.title.toLowerCase() === lower);
      if (!ch) break;
      const childRange = getContentRange(allNodes, ch.index, ch.depth);
      if (isSelector(s.schema)) {
        updateSelector(allNodes, ch.index, ch.depth, childRange, s.schema, value, tree);
      } else {
        for (const [key, childSel] of Object.entries(s.schema as SchemaShape)) {
          if (value && key in value) {
            updateSelector(allNodes, ch.index, ch.depth, childRange, childSel, value[key], tree);
          }
        }
      }
      break;
    }
    case "sections": {
      if (!Array.isArray(value)) break;
      const childHeadings = collectChildHeadings(allNodes, headingIndex, depth);
      const schemaObj = isSelector(s.schema) ? null : s.schema as SchemaShape;
      const titleKey = schemaObj
        ? Object.entries(schemaObj).find(([, sel]) => (sel as any)._tag === "title")?.[0]
        : null;
      if (!titleKey) break;

      for (const item of value) {
        const itemTitle = item[titleKey];
        if (!itemTitle) continue;
        const lower = String(itemTitle).toLowerCase();
        const ch = childHeadings.find((h) => h.title.toLowerCase() === lower);
        if (!ch) continue;
        const childRange = getContentRange(allNodes, ch.index, ch.depth);
        for (const [key, childSel] of Object.entries(schemaObj!)) {
          if (key in item && (childSel as any)._tag !== "title") {
            updateSelector(allNodes, ch.index, ch.depth, childRange, childSel, item[key], tree);
          }
        }
      }
      break;
    }
  }
}

function updateField(allNodes: RootContent[], range: { start: number; end: number }, key: string, value: string) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i]!;
    if (node.type !== "paragraph") continue;
    const para = node as Paragraph;
    for (let j = 0; j < para.children.length; j++) {
      const child = para.children[j]!;
      if (child.type === "strong" && inlineToText((child as Strong).children) === `${key}:`) {
        let nextBold = para.children.length;
        for (let k = j + 1; k < para.children.length; k++) {
          if (para.children[k]!.type === "strong") {
            nextBold = k;
            break;
          }
        }
        para.children.splice(j + 1, nextBold - j - 1, { type: "text", value: ` ${value}\n` } as Text);
        return;
      }
    }
  }
}

function updateList(allNodes: RootContent[], range: { start: number; end: number }, items: string[]) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i]!;
    if (node.type !== "list") continue;
    const list = node as List;
    list.children = items.map((text) => ({
      type: "listItem" as const,
      children: [{ type: "paragraph" as const, children: [{ type: "text" as const, value: text }] }],
    })) as any;
    return;
  }
}

function updateTasks(allNodes: RootContent[], range: { start: number; end: number }, tasks: { text: string; checked: boolean }[]) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i]!;
    if (node.type !== "list") continue;
    const list = node as List;
    let taskIdx = 0;
    for (const item of list.children) {
      const li = item as ListItem;
      if (li.checked === null || li.checked === undefined) continue;
      if (taskIdx < tasks.length) {
        li.checked = tasks[taskIdx]!.checked;
        if (li.children[0]?.type === "paragraph") {
          (li.children[0] as Paragraph).children = [{ type: "text", value: tasks[taskIdx]!.text } as Text];
        }
        taskIdx++;
      }
    }
    return;
  }
}

function updateText(allNodes: RootContent[], range: { start: number; end: number }, value: string) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i]!;
    if (node.type !== "paragraph") continue;
    const para = node as Paragraph;
    if (isFieldParagraph(para)) continue;
    para.children = [{ type: "text", value } as Text];
    return;
  }
}
