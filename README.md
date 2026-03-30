# markson

Structured read and write for Markdown. Define a schema, parse into typed objects, update values, get markdown back.

## Quick start

**Recipe:**

```ts
import { markson } from "markson";

const schema = markson.schema((_) => ({
  name: _.title(),
  ingredients: _.section("Ingredients", _.list()),
  steps: _.section("Steps", _.list()),
}));
```

```md
# Pasta Carbonara

## Ingredients
- 400g spaghetti
- 200g guanciale
- 4 egg yolks

## Steps
1. Boil pasta in salted water
2. Fry guanciale until crispy
3. Mix egg yolks with pecorino
```

```json
{
  "name": "Pasta Carbonara",
  "ingredients": ["400g spaghetti", "200g guanciale", "4 egg yolks"],
  "steps": ["Boil pasta in salted water", "Fry guanciale until crispy", "Mix egg yolks with pecorino"]
}
```

**Meeting notes:**

```ts
const schema = markson.schema((_) => ({
  title: _.title(),
  date: _.field("Date"),
  attendees: _.field("Attendees"),
  decisions: _.section("Decisions", _.list()),
  actions: _.section("Action Items", _.tasks()),
}));
```

```md
# Sprint Review

**Date:** 2026-03-28
**Attendees:** Alice, Bob, Carol

## Decisions
- Adopt Vitest for all new test suites
- Deprecate the legacy /v1 API

## Action Items
- [ ] Bob: Set up monitoring dashboard
- [x] Carol: Write migration guide
```

```json
{
  "title": "Sprint Review",
  "date": "2026-03-28",
  "attendees": "Alice, Bob, Carol",
  "decisions": ["Adopt Vitest for all new test suites", "Deprecate the legacy /v1 API"],
  "actions": [
    { "text": "Bob: Set up monitoring dashboard", "checked": false },
    { "text": "Carol: Write migration guide", "checked": true }
  ]
}
```

**Read and write:**

```ts
const meeting = markson(md, schema).parse();

const updated = markson(md, schema)
  .update({ actions: [{ text: "Bob: Set up monitoring dashboard", checked: true }] })
  .stringify();
```

## Selectors

Selectors describe where data lives in the markdown:

```
title()                          heading text → string
text()                           paragraphs → string
list()                           list items → string[]
code()                           code blocks → string[]
links()                          hyperlinks → { text, url }[]
table()                          GFM tables → Record<string, string>[]
tasks()                          checkboxes → { text, checked }[]
field("Key")                     **Key:** value → string | undefined
frontmatter<T>()                 YAML frontmatter → T | undefined
section("Name", list())          named section → extract value
section("Name", { ... })         named section → apply sub-schema
sections({ ... })                all child sections → array
```

## API

```ts
import { markson } from "markson";

// Define a schema
const schema = markson.schema((_) => ({
  name: _.title(),
  email: _.field("Email"),
  items: _.list(),
}));

// With schema — typed, read and write
const doc = markson(md, schema);
doc.parse()                // → { name: string, email: string | undefined, items: string[] }
doc.update(patch)          // → chainable
doc.stringify()            // → markdown string

// Without schema — flexible reads
markson(md).parse()                        // → raw Section
markson(md).parse((doc) => ({ ... }))      // → callback mapper
```

You can also import selectors directly:

```ts
import { markson, m } from "markson";

const schema = {
  name: m.title(),
  email: m.field("Email"),
};
```

### Type inference

```ts
import type { Infer } from "markson";
type Result = Infer<typeof schema>;
// { name: string, email: string | undefined }
```

## Examples

**Changelog — nested dynamic sections:**

```ts
const schema = markson.schema((_) => ({
  versions: _.sections({
    version: _.title(),
    categories: _.sections({
      type: _.title(),
      changes: _.list(),
    }),
  }),
}));

const changelog = markson(md, schema).parse();
// changelog.versions[0].categories[0].changes → ["New dashboard", ...]
```

**Resume — reusable sub-schemas, 3-level nesting:**

```ts
const projectSchema = markson.schema((_) => ({
  title: _.title(),
  achievements: _.list(),
  stack: _.field("Stack"),
}));

const schema = markson.schema((_) => ({
  name: _.title(),
  email: _.field("Email"),
  role: _.field("Role"),
  experience: _.section("Experience", _.sections({
    title: _.title(),
    stack: _.field("Stack"),
    projects: _.sections(projectSchema),
  })),
}));
```

**Blog post — frontmatter + update:**

```ts
const schema = markson.schema((_) => ({
  title: _.title(),
  meta: _.frontmatter<{ date: string; tags: string[]; draft: boolean }>(),
  sections: _.sections({ heading: _.title(), body: _.text() }),
}));

// Publish a draft
const published = markson(md, schema)
  .update({ meta: { date: "2026-04-01", tags: ["release"], draft: false } })
  .stringify();
```

## License

MIT
