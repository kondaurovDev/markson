// src/section.ts
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { parse as parseYaml } from "yaml";
var processor = remark().use(remarkGfm).use(remarkFrontmatter);
function buildRootSection(tree) {
  const firstHeading = tree.children.find((n) => n.type === "heading");
  if (!firstHeading) {
    return emptySection();
  }
  const title = inlineToText(firstHeading.children);
  const contentNodes = collectUntilNextHeading(tree.children, indexOf(tree.children, firstHeading) + 1, firstHeading.depth);
  const fmNode = tree.children.find((n) => n.type === "yaml");
  const fm = fmNode ? parseYaml(fmNode.value) : void 0;
  const section = buildSectionFromNodes(title, firstHeading.depth, contentNodes, tree.children, indexOf(tree.children, firstHeading));
  return { ...section, frontmatter: () => fm };
}
function buildSectionFromNodes(title, depth, contentNodes, allNodes, headingIndex) {
  const childHeadings = collectChildHeadings(allNodes, headingIndex, depth);
  const section = {
    title,
    text() {
      return extractParagraphs(contentNodes);
    },
    list() {
      const items = [];
      for (const node of contentNodes) {
        if (node.type === "list") {
          for (const item of node.children) {
            items.push(inlineToText(item.children.flatMap(
              (c) => c.type === "paragraph" ? c.children : []
            )));
          }
        }
      }
      return items;
    },
    code() {
      return contentNodes.filter((n) => n.type === "code").map((n) => n.value);
    },
    links() {
      const result = [];
      for (const node of contentNodes) {
        if (node.type === "paragraph") {
          collectLinks(node.children, result);
        }
        if (node.type === "list") {
          for (const item of node.children) {
            for (const child of item.children) {
              if (child.type === "paragraph") {
                collectLinks(child.children, result);
              }
            }
          }
        }
      }
      return result;
    },
    table() {
      const rows = [];
      for (const node of contentNodes) {
        if (node.type === "table") {
          const t = node;
          const headerRow = t.children[0];
          if (!headerRow) continue;
          const headers = headerRow.children.map((cell) => inlineToText(cell.children));
          for (let i = 1; i < t.children.length; i++) {
            const row = t.children[i];
            const record = {};
            for (let j = 0; j < headers.length; j++) {
              record[headers[j]] = row.children[j] ? inlineToText(row.children[j].children) : "";
            }
            rows.push(record);
          }
        }
      }
      return rows;
    },
    tasks() {
      const result = [];
      for (const node of contentNodes) {
        if (node.type === "list") {
          for (const item of node.children) {
            const li = item;
            if (li.checked !== null && li.checked !== void 0) {
              result.push({
                text: inlineToText(li.children.flatMap(
                  (c) => c.type === "paragraph" ? c.children : []
                )),
                checked: li.checked
              });
            }
          }
        }
      }
      return result;
    },
    at(...path) {
      return path.reduce((s, name) => s.section(name), section);
    },
    section(name) {
      const lower = name.toLowerCase();
      return this.sections().find((s) => s.title.toLowerCase() === lower) ?? emptySection();
    },
    sections() {
      return childHeadings.map((ch) => {
        const nodes = collectUntilNextHeading(allNodes, ch.index + 1, ch.depth);
        return buildSectionFromNodes(ch.title, ch.depth, nodes, allNodes, ch.index);
      });
    },
    field(key) {
      for (const node of contentNodes) {
        if (node.type === "paragraph") {
          const result = extractBoldValue(node.children, key);
          if (result !== void 0) return result;
        }
      }
      return void 0;
    },
    frontmatter() {
      return void 0;
    }
  };
  return section;
}
function collectUntilNextHeading(nodes, startIndex, depth) {
  const result = [];
  for (let i = startIndex; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "heading" && node.depth <= depth) break;
    if (node.type !== "heading") {
      result.push(node);
    }
  }
  return result;
}
function collectChildHeadings(nodes, headingIndex, parentDepth) {
  const children = [];
  for (let i = headingIndex + 1; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "heading") {
      const h = node;
      if (h.depth <= parentDepth) break;
      if (h.depth === parentDepth + 1) {
        children.push({ title: inlineToText(h.children), depth: h.depth, index: i });
      }
    }
  }
  return children;
}
function inlineToText(nodes) {
  return nodes.map((n) => {
    if (n.type === "text") return n.value;
    if (n.type === "strong") return inlineToText(n.children);
    if (n.type === "emphasis") return inlineToText(n.children);
    if (n.type === "link") return inlineToText(n.children);
    if (n.type === "inlineCode") return n.value;
    return "";
  }).join("");
}
function extractParagraphs(nodes) {
  return nodes.filter((n) => n.type === "paragraph" && !isFieldParagraph(n)).map((n) => inlineToText(n.children)).join("\n");
}
function isFieldParagraph(para) {
  const first = para.children[0];
  if (!first || first.type !== "strong") return false;
  const text = inlineToText(first.children);
  return text.endsWith(":");
}
function extractBoldValue(nodes, key) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "strong") {
      const strongText = inlineToText(node.children);
      if (strongText === `${key}:`) {
        const rest = [];
        for (let j = i + 1; j < nodes.length; j++) {
          const next = nodes[j];
          if (next.type === "strong") break;
          const text = next.type === "text" ? next.value : inlineToText([next]);
          rest.push(text);
        }
        const value = rest.join("").trim().replace(/\n.*$/, "").trim();
        return value || void 0;
      }
    }
  }
  return void 0;
}
function indexOf(nodes, target) {
  return nodes.indexOf(target);
}
function collectLinks(nodes, result) {
  for (const n of nodes) {
    if (n.type === "link") {
      result.push({ text: inlineToText(n.children), url: n.url });
    } else if ("children" in n && Array.isArray(n.children)) {
      collectLinks(n.children, result);
    }
  }
}
function emptySection() {
  return {
    title: "",
    text: () => "",
    list: () => [],
    code: () => [],
    links: () => [],
    table: () => [],
    tasks: () => [],
    at: (..._path) => emptySection(),
    section: () => emptySection(),
    sections: () => [],
    field: () => void 0,
    frontmatter: () => void 0
  };
}

// src/schema.ts
function isSelector(x) {
  return typeof x === "object" && x !== null && "_tag" in x;
}
function _title() {
  return { _tag: "title" };
}
function _text() {
  return { _tag: "text" };
}
function _list() {
  return { _tag: "list" };
}
function _code() {
  return { _tag: "code" };
}
function _links() {
  return { _tag: "links" };
}
function _table() {
  return { _tag: "table" };
}
function _tasks() {
  return { _tag: "tasks" };
}
function _field(key) {
  return { _tag: "field", key };
}
function _frontmatter() {
  return { _tag: "frontmatter" };
}
function _section(name, schemaOrSelector) {
  return { _tag: "section", name, schema: schemaOrSelector };
}
function _sections(schemaOrSelector) {
  return { _tag: "sections", schema: schemaOrSelector };
}
var m = {
  title: _title,
  text: _text,
  list: _list,
  code: _code,
  links: _links,
  table: _table,
  tasks: _tasks,
  field: _field,
  frontmatter: _frontmatter,
  section: _section,
  sections: _sections
};

// src/read.ts
function executeSchema(section, schemaOrSelector) {
  if (isSelector(schemaOrSelector)) {
    return executeSelector(section, schemaOrSelector);
  }
  const result = {};
  for (const [key, selector] of Object.entries(schemaOrSelector)) {
    result[key] = executeSelector(section, selector);
  }
  return result;
}
function executeSelector(section, sel) {
  const s = sel;
  switch (s._tag) {
    case "title":
      return section.title;
    case "text":
      return section.text();
    case "list":
      return section.list();
    case "code":
      return section.code();
    case "links":
      return section.links();
    case "table":
      return section.table();
    case "tasks":
      return section.tasks();
    case "field":
      return section.field(s.key);
    case "frontmatter":
      return section.frontmatter();
    case "section": {
      const child = section.section(s.name);
      return executeSchema(child, s.schema);
    }
    case "sections": {
      return section.sections().map((child) => executeSchema(child, s.schema));
    }
    default:
      return void 0;
  }
}

// src/update.ts
function executeUpdateOnTree(tree, schema, patch) {
  const firstHeading = tree.children.find((n) => n.type === "heading");
  if (!firstHeading) return;
  const headingIndex = tree.children.indexOf(firstHeading);
  const contentRange = getContentRange(tree.children, headingIndex, firstHeading.depth);
  for (const [key, selector] of Object.entries(schema)) {
    if (!(key in patch)) continue;
    updateSelector(tree.children, headingIndex, firstHeading.depth, contentRange, selector, patch[key], tree);
  }
}
function getContentRange(nodes, headingIndex, depth) {
  const start = headingIndex + 1;
  let end = nodes.length;
  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "heading" && node.depth <= depth) {
      end = i;
      break;
    }
  }
  return { start, end };
}
function updateSelector(allNodes, headingIndex, depth, contentRange, sel, value, tree) {
  const s = sel;
  switch (s._tag) {
    case "title": {
      const heading = allNodes[headingIndex];
      heading.children = [{ type: "text", value: String(value) }];
      break;
    }
    case "field": {
      updateField(allNodes, contentRange, s.key, String(value));
      break;
    }
    case "list": {
      updateList(allNodes, contentRange, value);
      break;
    }
    case "tasks": {
      updateTasks(allNodes, contentRange, value);
      break;
    }
    case "frontmatter": {
      const fmIndex = tree.children.findIndex((n) => n.type === "yaml");
      const yamlStr = Object.entries(value).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
      if (fmIndex >= 0) {
        tree.children[fmIndex].value = yamlStr;
      } else {
        tree.children.unshift({ type: "yaml", value: yamlStr });
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
        for (const [key, childSel] of Object.entries(s.schema)) {
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
      const schemaObj = isSelector(s.schema) ? null : s.schema;
      const titleKey = schemaObj ? Object.entries(schemaObj).find(([, sel2]) => sel2._tag === "title")?.[0] : null;
      if (!titleKey) break;
      for (const item of value) {
        const itemTitle = item[titleKey];
        if (!itemTitle) continue;
        const lower = String(itemTitle).toLowerCase();
        const ch = childHeadings.find((h) => h.title.toLowerCase() === lower);
        if (!ch) continue;
        const childRange = getContentRange(allNodes, ch.index, ch.depth);
        for (const [key, childSel] of Object.entries(schemaObj)) {
          if (key in item && childSel._tag !== "title") {
            updateSelector(allNodes, ch.index, ch.depth, childRange, childSel, item[key], tree);
          }
        }
      }
      break;
    }
  }
}
function updateField(allNodes, range, key, value) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i];
    if (node.type !== "paragraph") continue;
    const para = node;
    for (let j = 0; j < para.children.length; j++) {
      const child = para.children[j];
      if (child.type === "strong" && inlineToText(child.children) === `${key}:`) {
        let nextBold = para.children.length;
        for (let k = j + 1; k < para.children.length; k++) {
          if (para.children[k].type === "strong") {
            nextBold = k;
            break;
          }
        }
        para.children.splice(j + 1, nextBold - j - 1, { type: "text", value: ` ${value}
` });
        return;
      }
    }
  }
}
function updateList(allNodes, range, items) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i];
    if (node.type !== "list") continue;
    const list = node;
    list.children = items.map((text) => ({
      type: "listItem",
      children: [{ type: "paragraph", children: [{ type: "text", value: text }] }]
    }));
    return;
  }
}
function updateTasks(allNodes, range, tasks) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i];
    if (node.type !== "list") continue;
    const list = node;
    let taskIdx = 0;
    for (const item of list.children) {
      const li = item;
      if (li.checked === null || li.checked === void 0) continue;
      if (taskIdx < tasks.length) {
        li.checked = tasks[taskIdx].checked;
        if (li.children[0]?.type === "paragraph") {
          li.children[0].children = [{ type: "text", value: tasks[taskIdx].text }];
        }
        taskIdx++;
      }
    }
    return;
  }
}
function updateText(allNodes, range, value) {
  for (let i = range.start; i < range.end; i++) {
    const node = allNodes[i];
    if (node.type !== "paragraph") continue;
    const para = node;
    if (isFieldParagraph(para)) continue;
    para.children = [{ type: "text", value }];
    return;
  }
}

// src/index.ts
var markson = Object.assign(
  function markson2(markdown, schema) {
    const tree = processor.parse(markdown);
    const root = buildRootSection(tree);
    if (schema) {
      const typed = {
        parse() {
          return executeSchema(root, schema);
        },
        update(patch) {
          executeUpdateOnTree(tree, schema, patch);
          return typed;
        },
        stringify() {
          return processor.stringify(tree);
        }
      };
      return typed;
    }
    const doc = {
      parse(arg) {
        if (!arg) return root;
        if (typeof arg === "function") return arg(root);
        return executeSchema(root, arg);
      },
      stringify() {
        return processor.stringify(tree);
      }
    };
    return doc;
  },
  {
    schema: (factory) => factory(m)
  }
);
export {
  m,
  markson
};
