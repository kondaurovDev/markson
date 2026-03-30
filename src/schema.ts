/**
 * @module schema
 *
 * Schema types and selector factories.
 * Selectors are bidirectional lenses — they describe how to read from and write to markdown AST.
 */

interface SelectorBase<Tag extends string, T> {
  readonly _tag: Tag;
  /** Phantom type — carries the output type for inference. Never populated at runtime. */
  readonly _output: T;
}

type TitleSelector = SelectorBase<"title", string>;
type TextSelector = SelectorBase<"text", string>;
type ListSelector = SelectorBase<"list", string[]>;
type CodeSelector = SelectorBase<"code", string[]>;
type LinksSelector = SelectorBase<"links", { text: string; url: string }[]>;
type TableSelector = SelectorBase<"table", Record<string, string>[]>;
type TasksSelector = SelectorBase<"tasks", { text: string; checked: boolean }[]>;
type FieldSelector = SelectorBase<"field", string | undefined> & { readonly key: string };
type FrontmatterSelector<T> = SelectorBase<"frontmatter", T | undefined>;

/** A selector descriptor. Carries a `_tag` for runtime dispatch and `_output` for type inference. */
export type Selector<T = any> = SelectorBase<string, T>;

/** A schema — a plain object whose values are selectors. */
export type SchemaShape = { readonly [key: string]: Selector<any> };

/** Infers the output type of a schema. `Infer<typeof mySchema>` gives you the parsed data type. */
export type Infer<S extends SchemaShape> = { [K in keyof S]: S[K]["_output"] };

/** @internal */
export function isSelector(x: unknown): x is Selector {
  return typeof x === "object" && x !== null && "_tag" in x;
}

/** Heading text of the current section. → `string` */
function _title(): TitleSelector {
  return { _tag: "title" } as TitleSelector;
}
/** Concatenated paragraph text (excludes `**Key:** value` fields). → `string` */
function _text(): TextSelector {
  return { _tag: "text" } as TextSelector;
}
/** All list items as strings. → `string[]` */
function _list(): ListSelector {
  return { _tag: "list" } as ListSelector;
}
/** Code block contents. → `string[]` */
function _code(): CodeSelector {
  return { _tag: "code" } as CodeSelector;
}
/** All hyperlinks. → `{ text: string; url: string }[]` */
function _links(): LinksSelector {
  return { _tag: "links" } as LinksSelector;
}
/** GFM table rows, keys from header. → `Record<string, string>[]` */
function _table(): TableSelector {
  return { _tag: "table" } as TableSelector;
}
/** Checkbox list items. → `{ text: string; checked: boolean }[]` */
function _tasks(): TasksSelector {
  return { _tag: "tasks" } as TasksSelector;
}
/** Extracts a value from a `**Key:** value` pattern. → `string | undefined` */
function _field(key: string): FieldSelector {
  return { _tag: "field", key } as FieldSelector;
}
/** Parsed YAML frontmatter. → `T | undefined` */
function _frontmatter<T = Record<string, unknown>>(): FrontmatterSelector<T> {
  return { _tag: "frontmatter" } as FrontmatterSelector<T>;
}

/**
 * Navigates into a named child section.
 * With a single selector: `m.section("List", m.list())` → `string[]`
 * With a sub-schema: `m.section("Job", { title: m.title() })` → `{ title: string }`
 */
function _section<T>(name: string, selector: Selector<T>): Selector<T>;
function _section<S extends SchemaShape>(name: string, schema: S): Selector<Infer<S>>;
function _section(name: string, schemaOrSelector: any): any {
  return { _tag: "section", name, schema: schemaOrSelector };
}

/**
 * Maps all direct child sections through a schema or selector.
 * `title()` inside the sub-schema acts as a primary key for `update()`.
 */
function _sections<T>(selector: Selector<T>): Selector<T[]>;
function _sections<S extends SchemaShape>(schema: S): Selector<Infer<S>[]>;
function _sections(schemaOrSelector: any): any {
  return { _tag: "sections", schema: schemaOrSelector };
}

/**
 * Namespace for all selector factories.
 *
 * @example
 * ```ts
 * import { m } from "markson";
 *
 * const schema = {
 *   name: m.title(),
 *   email: m.field("Email"),
 *   items: m.section("List", m.list()),
 * };
 * ```
 */
export const m = {
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
  sections: _sections,
};
