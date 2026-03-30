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

import { processor, buildRootSection } from "./section";
import { executeSchema } from "./read";
import { executeUpdateOnTree } from "./update";
import type { SchemaShape, Infer } from "./schema";
import { m } from "./schema";
import type { Section } from "./section";

export type { Section } from "./section";
export type { Selector, SchemaShape, Infer } from "./schema";
export { m } from "./schema";

/** Document without a bound schema. Supports callback mappers, one-off schema parses, and raw Section access. */
export interface MarksonDocument {
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
export interface TypedMarksonDocument<S extends SchemaShape> {
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

export const markson: MarksonFn = Object.assign(
  function markson(markdown: string, schema?: SchemaShape): any {
    const tree = processor.parse(markdown);
    const root = buildRootSection(tree);

    if (schema) {
      const typed: TypedMarksonDocument<any> = {
        parse() {
          return executeSchema(root, schema);
        },
        update(patch: Record<string, any>) {
          executeUpdateOnTree(tree, schema, patch);
          return typed;
        },
        stringify() {
          return processor.stringify(tree);
        },
      };
      return typed;
    }

    const doc: MarksonDocument = {
      parse(arg?: any) {
        if (!arg) return root;
        if (typeof arg === "function") return arg(root);
        return executeSchema(root, arg);
      },
      stringify() {
        return processor.stringify(tree);
      },
    };
    return doc;
  },
  {
    schema: <S extends SchemaShape>(factory: (selectors: typeof m) => S): S => factory(m),
  },
);
