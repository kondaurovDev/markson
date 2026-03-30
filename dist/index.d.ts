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
type LinksSelector = SelectorBase<"links", {
    text: string;
    url: string;
}[]>;
type TableSelector = SelectorBase<"table", Record<string, string>[]>;
type TasksSelector = SelectorBase<"tasks", {
    text: string;
    checked: boolean;
}[]>;
type FieldSelector = SelectorBase<"field", string | undefined> & {
    readonly key: string;
};
type FrontmatterSelector<T> = SelectorBase<"frontmatter", T | undefined>;
/** A selector descriptor. Carries a `_tag` for runtime dispatch and `_output` for type inference. */
type Selector<T = any> = SelectorBase<string, T>;
/** A schema — a plain object whose values are selectors. */
type SchemaShape = {
    readonly [key: string]: Selector<any>;
};
/** Infers the output type of a schema. `Infer<typeof mySchema>` gives you the parsed data type. */
type Infer<S extends SchemaShape> = {
    [K in keyof S]: S[K]["_output"];
};
/** Heading text of the current section. → `string` */
declare function _title(): TitleSelector;
/** Concatenated paragraph text (excludes `**Key:** value` fields). → `string` */
declare function _text(): TextSelector;
/** All list items as strings. → `string[]` */
declare function _list(): ListSelector;
/** Code block contents. → `string[]` */
declare function _code(): CodeSelector;
/** All hyperlinks. → `{ text: string; url: string }[]` */
declare function _links(): LinksSelector;
/** GFM table rows, keys from header. → `Record<string, string>[]` */
declare function _table(): TableSelector;
/** Checkbox list items. → `{ text: string; checked: boolean }[]` */
declare function _tasks(): TasksSelector;
/** Extracts a value from a `**Key:** value` pattern. → `string | undefined` */
declare function _field(key: string): FieldSelector;
/** Parsed YAML frontmatter. → `T | undefined` */
declare function _frontmatter<T = Record<string, unknown>>(): FrontmatterSelector<T>;
/**
 * Navigates into a named child section.
 * With a single selector: `m.section("List", m.list())` → `string[]`
 * With a sub-schema: `m.section("Job", { title: m.title() })` → `{ title: string }`
 */
declare function _section<T>(name: string, selector: Selector<T>): Selector<T>;
declare function _section<S extends SchemaShape>(name: string, schema: S): Selector<Infer<S>>;
/**
 * Maps all direct child sections through a schema or selector.
 * `title()` inside the sub-schema acts as a primary key for `update()`.
 */
declare function _sections<T>(selector: Selector<T>): Selector<T[]>;
declare function _sections<S extends SchemaShape>(schema: S): Selector<Infer<S>[]>;
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
declare const m: {
    title: typeof _title;
    text: typeof _text;
    list: typeof _list;
    code: typeof _code;
    links: typeof _links;
    table: typeof _table;
    tasks: typeof _tasks;
    field: typeof _field;
    frontmatter: typeof _frontmatter;
    section: typeof _section;
    sections: typeof _sections;
};

/**
 * A section of a markdown document. Provides methods to extract structured data
 * from the content between headings.
 *
 * Missing sections return an empty Section — all methods return empty values,
 * so you can chain safely without null checks.
 */
interface Section {
    title: string;
    text(): string;
    list(): string[];
    code(): string[];
    links(): {
        text: string;
        url: string;
    }[];
    table(): Record<string, string>[];
    tasks(): {
        text: string;
        checked: boolean;
    }[];
    at(...path: string[]): Section;
    section(title: string): Section;
    sections(): Section[];
    field(key: string): string | undefined;
    frontmatter<T = Record<string, unknown>>(): T | undefined;
}

/**
 * @module markson
 *
 * Markdown as a data format. Define a schema, parse markdown into typed objects,
 * update values, and serialize back to markdown.
 *
 * @example
 * ```ts
 * import { markson, m } from "markson";
 *
 * const schema = { name: m.title(), items: m.section("List", m.list()) };
 * const data = markson(md, schema).parse();
 * const updated = markson(md, schema).update({ items: ["a", "b"] }).stringify();
 * ```
 */

/** Document without a bound schema. Supports callback mappers, one-off schema parses, and raw Section access. */
interface MarksonDocument {
    /** Returns the raw {@link Section} tree. */
    parse(): Section;
    /** Passes the root section to `mapper` and returns the result with full type inference. */
    parse<T>(mapper: (doc: Section) => T): T;
    /** One-off schema parse — returns a typed object inferred from `schema`. */
    parse<S extends SchemaShape>(schema: S): Infer<S>;
    /** Serializes the (possibly mutated) AST back to a markdown string. */
    stringify(): string;
}
/** Document with a bound schema. Knows its shape — `parse()` returns typed data, `update()` accepts a partial patch. */
interface TypedMarksonDocument<S extends SchemaShape> {
    /** Parses the markdown according to the bound schema. Returns `Infer<S>`. */
    parse(): Infer<S>;
    /** Applies a partial patch to the AST and returns the same document for chaining. */
    update(patch: Partial<Infer<S>>): TypedMarksonDocument<S>;
    /** Serializes the (possibly mutated) AST back to a markdown string. */
    stringify(): string;
}
/**
 * Creates a markson document from a markdown string.
 *
 * Without a schema, returns an untyped {@link MarksonDocument} for flexible reads.
 * With a schema, returns a {@link TypedMarksonDocument} for typed reads and writes.
 *
 * @example
 * ```ts
 * // Typed — schema bound, bidirectional
 * const doc = markson(md, { name: m.title(), items: m.list() });
 * doc.parse();                       // { name: string, items: string[] }
 * doc.update({ name: "New" }).stringify();
 *
 * // Untyped — raw section access
 * const doc = markson(md);
 * doc.parse().section("Intro").text();
 * ```
 */
interface MarksonFn {
    (markdown: string): MarksonDocument;
    <S extends SchemaShape>(markdown: string, schema: S): TypedMarksonDocument<S>;
    /**
     * Creates a schema by injecting selectors into a factory function.
     * Avoids needing a separate `m` import.
     *
     * @example
     * ```ts
     * const schema = markson.schema(({ title, field, section, list }) => ({
     *   name: title(),
     *   email: field("Email"),
     *   items: section("List", list()),
     * }));
     * ```
     */
    schema: <S extends SchemaShape>(factory: (selectors: typeof m) => S) => S;
}
declare const markson: MarksonFn;

export { type Infer, type MarksonDocument, type SchemaShape, type Section, type Selector, type TypedMarksonDocument, m, markson };
