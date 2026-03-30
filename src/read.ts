/**
 * @module read
 *
 * Read engine — walks a schema against a Section tree to extract structured data.
 */

import type { Section } from "./section";
import type { Selector, SchemaShape } from "./schema";
import { isSelector } from "./schema";

/** Executes a schema or single selector against a Section, returning the extracted data. */
export function executeSchema(section: Section, schemaOrSelector: SchemaShape | Selector): any {
  if (isSelector(schemaOrSelector)) {
    return executeSelector(section, schemaOrSelector);
  }
  const result: Record<string, any> = {};
  for (const [key, selector] of Object.entries(schemaOrSelector)) {
    result[key] = executeSelector(section, selector);
  }
  return result;
}

function executeSelector(section: Section, sel: Selector): any {
  const s = sel as any;
  switch (s._tag) {
    case "title": return section.title;
    case "text": return section.text();
    case "list": return section.list();
    case "code": return section.code();
    case "links": return section.links();
    case "table": return section.table();
    case "tasks": return section.tasks();
    case "field": return section.field(s.key);
    case "frontmatter": return section.frontmatter();
    case "section": {
      const child = section.section(s.name);
      return executeSchema(child, s.schema);
    }
    case "sections": {
      return section.sections().map((child: Section) => executeSchema(child, s.schema));
    }
    default: return undefined;
  }
}
