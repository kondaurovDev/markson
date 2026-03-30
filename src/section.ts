/**
 * @module section
 *
 * Section tree — the runtime representation of a parsed markdown document.
 * Each Section corresponds to a heading and its content until the next heading at the same or higher level.
 */

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { parse as parseYaml } from "yaml";
import type { Root, RootContent, Heading, List, ListItem, Paragraph, PhrasingContent, Strong, Text, Link, Code, Table, TableRow } from "mdast";

/**
 * A section of a markdown document. Provides methods to extract structured data
 * from the content between headings.
 *
 * Missing sections return an empty Section — all methods return empty values,
 * so you can chain safely without null checks.
 */
export interface Section {
  title: string;
  text(): string;
  list(): string[];
  code(): string[];
  links(): { text: string; url: string }[];
  table(): Record<string, string>[];
  tasks(): { text: string; checked: boolean }[];
  at(...path: string[]): Section;
  section(title: string): Section;
  sections(): Section[];
  field(key: string): string | undefined;
  frontmatter<T = Record<string, unknown>>(): T | undefined;
}

/** @internal Shared remark processor with GFM and frontmatter support. */
export const processor = remark().use(remarkGfm).use(remarkFrontmatter);

/** @internal Builds the root Section from an mdast tree. */
export function buildRootSection(tree: Root): Section {
  const firstHeading = tree.children.find((n): n is Heading => n.type === "heading");

  if (!firstHeading) {
    return emptySection();
  }

  const title = inlineToText(firstHeading.children);
  const contentNodes = collectUntilNextHeading(tree.children, indexOf(tree.children, firstHeading) + 1, firstHeading.depth);

  const fmNode = tree.children.find((n) => n.type === "yaml");
  const fm = fmNode ? parseYaml((fmNode as { value: string }).value) : undefined;

  const section = buildSectionFromNodes(title, firstHeading.depth, contentNodes, tree.children, indexOf(tree.children, firstHeading));
  return { ...section, frontmatter: <T = Record<string, unknown>>() => fm as T | undefined };
}

function buildSectionFromNodes(
  title: string,
  depth: number,
  contentNodes: RootContent[],
  allNodes: RootContent[],
  headingIndex: number,
): Section {
  const childHeadings = collectChildHeadings(allNodes, headingIndex, depth);

  const section: Section = {
    title,

    text() {
      return extractParagraphs(contentNodes);
    },

    list() {
      const items: string[] = [];
      for (const node of contentNodes) {
        if (node.type === "list") {
          for (const item of (node as List).children) {
            items.push(inlineToText(item.children.flatMap((c) =>
              c.type === "paragraph" ? (c as Paragraph).children : []
            )));
          }
        }
      }
      return items;
    },

    code() {
      return contentNodes
        .filter((n) => n.type === "code")
        .map((n) => (n as Code).value);
    },

    links() {
      const result: { text: string; url: string }[] = [];
      for (const node of contentNodes) {
        if (node.type === "paragraph") {
          collectLinks((node as Paragraph).children, result);
        }
        if (node.type === "list") {
          for (const item of (node as List).children) {
            for (const child of item.children) {
              if (child.type === "paragraph") {
                collectLinks((child as Paragraph).children, result);
              }
            }
          }
        }
      }
      return result;
    },

    table() {
      const rows: Record<string, string>[] = [];
      for (const node of contentNodes) {
        if (node.type === "table") {
          const t = node as Table;
          const headerRow = t.children[0] as TableRow | undefined;
          if (!headerRow) continue;
          const headers = headerRow.children.map((cell) => inlineToText(cell.children));
          for (let i = 1; i < t.children.length; i++) {
            const row = t.children[i] as TableRow;
            const record: Record<string, string> = {};
            for (let j = 0; j < headers.length; j++) {
              record[headers[j]!] = row.children[j] ? inlineToText(row.children[j]!.children) : "";
            }
            rows.push(record);
          }
        }
      }
      return rows;
    },

    tasks() {
      const result: { text: string; checked: boolean }[] = [];
      for (const node of contentNodes) {
        if (node.type === "list") {
          for (const item of (node as List).children) {
            const li = item as ListItem;
            if (li.checked !== null && li.checked !== undefined) {
              result.push({
                text: inlineToText(li.children.flatMap((c) =>
                  c.type === "paragraph" ? (c as Paragraph).children : []
                )),
                checked: li.checked,
              });
            }
          }
        }
      }
      return result;
    },

    at(...path: string[]) {
      return path.reduce<Section>((s, name) => s.section(name), section);
    },

    section(name: string) {
      const lower = name.toLowerCase();
      return this.sections().find((s) => s.title.toLowerCase() === lower) ?? emptySection();
    },

    sections() {
      return childHeadings.map((ch) => {
        const nodes = collectUntilNextHeading(allNodes, ch.index + 1, ch.depth);
        return buildSectionFromNodes(ch.title, ch.depth, nodes, allNodes, ch.index);
      });
    },

    field(key: string) {
      for (const node of contentNodes) {
        if (node.type === "paragraph") {
          const result = extractBoldValue((node as Paragraph).children, key);
          if (result !== undefined) return result;
        }
      }
      return undefined;
    },

    frontmatter() {
      return undefined;
    },
  };

  return section;
}

// --- Shared helpers (also used by update engine) ---

export function collectUntilNextHeading(nodes: RootContent[], startIndex: number, depth: number): RootContent[] {
  const result: RootContent[] = [];
  for (let i = startIndex; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "heading" && (node as Heading).depth <= depth) break;
    if (node.type !== "heading") {
      result.push(node);
    }
  }
  return result;
}

export function collectChildHeadings(nodes: RootContent[], headingIndex: number, parentDepth: number): { title: string; depth: number; index: number }[] {
  const children: { title: string; depth: number; index: number }[] = [];
  for (let i = headingIndex + 1; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "heading") {
      const h = node as Heading;
      if (h.depth <= parentDepth) break;
      if (h.depth === parentDepth + 1) {
        children.push({ title: inlineToText(h.children), depth: h.depth, index: i });
      }
    }
  }
  return children;
}

export function inlineToText(nodes: PhrasingContent[]): string {
  return nodes.map((n) => {
    if (n.type === "text") return (n as Text).value;
    if (n.type === "strong") return inlineToText((n as Strong).children);
    if (n.type === "emphasis") return inlineToText(n.children);
    if (n.type === "link") return inlineToText((n as Link).children);
    if (n.type === "inlineCode") return n.value;
    return "";
  }).join("");
}

function extractParagraphs(nodes: RootContent[]): string {
  return nodes
    .filter((n) => n.type === "paragraph" && !isFieldParagraph(n as Paragraph))
    .map((n) => inlineToText((n as Paragraph).children))
    .join("\n");
}

export function isFieldParagraph(para: Paragraph): boolean {
  const first = para.children[0];
  if (!first || first.type !== "strong") return false;
  const text = inlineToText((first as Strong).children);
  return text.endsWith(":");
}

function extractBoldValue(nodes: PhrasingContent[], key: string): string | undefined {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "strong") {
      const strongText = inlineToText((node as Strong).children);
      if (strongText === `${key}:`) {
        const rest: string[] = [];
        for (let j = i + 1; j < nodes.length; j++) {
          const next = nodes[j]!;
          if (next.type === "strong") break;
          const text = next.type === "text" ? (next as Text).value : inlineToText([next]);
          rest.push(text);
        }
        const value = rest.join("").trim().replace(/\n.*$/, "").trim();
        return value || undefined;
      }
    }
  }
  return undefined;
}

function indexOf(nodes: RootContent[], target: RootContent): number {
  return nodes.indexOf(target);
}

function collectLinks(nodes: PhrasingContent[], result: { text: string; url: string }[]) {
  for (const n of nodes) {
    if (n.type === "link") {
      result.push({ text: inlineToText((n as Link).children), url: (n as Link).url });
    } else if ("children" in n && Array.isArray(n.children)) {
      collectLinks(n.children as PhrasingContent[], result);
    }
  }
}

function emptySection(): Section {
  return {
    title: "",
    text: () => "",
    list: () => [],
    code: () => [],
    links: () => [],
    table: () => [],
    tasks: () => [],
    at: (..._path: string[]) => emptySection(),
    section: () => emptySection(),
    sections: () => [],
    field: () => undefined,
    frontmatter: () => undefined,
  };
}
