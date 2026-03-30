import { describe, it, expect } from "vitest";
import { markson, m } from "../src/index";

function md(strings: TemplateStringsArray) {
  const raw = strings[0]!;
  const lines = raw.replace(/^\n/, "").replace(/\n$/, "").split("\n");
  const indent = Math.min(
    ...lines.filter((l) => l.trim().length > 0).map((l) => l.match(/^ */)![0]!.length),
  );
  return lines.map((l) => l.slice(indent)).join("\n");
}

describe("title + text", () => {
  const doc = md`
    # My Document

    This is the introduction paragraph.
  `;

  it("extracts title and text", () => {
    const data = markson(doc, { name: m.title(), intro: m.text() }).parse();
    expect(data.name).toBe("My Document");
    expect(data.intro).toBe("This is the introduction paragraph.");
  });
});

describe("list", () => {
  const doc = md`
    # Shopping

    ## Items
    - Milk
    - Bread
    - Eggs
  `;

  it("extracts list items", () => {
    const data = markson(doc, { items: m.section("Items", m.list()) }).parse();
    expect(data.items).toEqual(["Milk", "Bread", "Eggs"]);
  });
});

describe("field", () => {
  const doc = md`
    # Invoice

    **Client:** Acme Corp
    **Amount:** $5,000
    **Due:** 2026-04-15
  `;

  const schema = {
    title: m.title(),
    client: m.field("Client"),
    amount: m.field("Amount"),
    due: m.field("Due"),
  };

  it("extracts bold key-value fields", () => {
    const data = markson(doc, schema).parse();
    expect(data.client).toBe("Acme Corp");
    expect(data.amount).toBe("$5,000");
    expect(data.due).toBe("2026-04-15");
  });

  it("text() excludes fields", () => {
    expect(markson(doc).parse().text()).not.toContain("Client:");
  });

  it("returns undefined for missing field", () => {
    expect(markson(doc, { x: m.field("Nope") }).parse().x).toBeUndefined();
  });
});

describe("tasks", () => {
  const doc = md`
    # Sprint

    ## TODO
    - [x] Deploy v2
    - [ ] Write docs
    - [ ] Update changelog
  `;

  it("extracts checkboxes with state", () => {
    const data = markson(doc, { todo: m.section("TODO", m.tasks()) }).parse();
    expect(data.todo).toEqual([
      { text: "Deploy v2", checked: true },
      { text: "Write docs", checked: false },
      { text: "Update changelog", checked: false },
    ]);
  });
});

describe("table", () => {
  const doc = md`
    # Team

    | Name  | Role     |
    | ----- | -------- |
    | Alice | Engineer |
    | Bob   | Designer |
  `;

  it("extracts table as records", () => {
    const data = markson(doc, { members: m.table() }).parse();
    expect(data.members).toEqual([
      { Name: "Alice", Role: "Engineer" },
      { Name: "Bob", Role: "Designer" },
    ]);
  });
});

describe("code", () => {
  const doc = md`
    # Setup

    Install:

    ~~~bash
    pnpm add markson
    ~~~
  `;

  it("extracts code blocks", () => {
    const data = markson(doc, { commands: m.code() }).parse();
    expect(data.commands).toEqual(["pnpm add markson"]);
  });
});

describe("links", () => {
  const doc = md`
    # Resources

    - [GitHub](https://github.com)
    - [Docs](https://docs.example.com)
  `;

  it("extracts links with text and url", () => {
    const data = markson(doc, { title: m.title(), links: m.links() }).parse();
    expect(data.title).toEqual('Resources')
    expect(data.links).toEqual([
      { text: "GitHub", url: "https://github.com" },
      { text: "Docs", url: "https://docs.example.com" },
    ]);
  });
});

describe("frontmatter", () => {
  const doc = md`
    ---
    title: Hello
    tags: [a, b]
    draft: true
    ---

    # Hello

    Some content.
  `;

  it("extracts YAML frontmatter", () => {
    const schema = {
      title: m.title(),
      meta: m.frontmatter<{ title: string; tags: string[]; draft: boolean }>(),
    };
    const data = markson(doc, schema).parse();
    expect(data.meta?.tags).toEqual(["a", "b"]);
    expect(data.meta?.draft).toBe(true);
  });
});

describe("nested sections", () => {
  const doc = md`
    # Docs

    ## Getting Started
    Install the package and run it.

    ## API

    ### parse
    Parses markdown.

    ### update
    Updates values.
  `;

  const schema = {
    title: m.title(),
    sections: m.sections({
      name: m.title(),
      body: m.text(),
      subsections: m.sections({ name: m.title(), body: m.text() }),
    }),
  };

  it("extracts nested section hierarchy", () => {
    const data = markson(doc, schema).parse();
    expect(data.sections.map((s) => s.name)).toEqual(["Getting Started", "API"]);
    expect(data.sections[1]!.subsections.map((s) => s.name)).toEqual(["parse", "update"]);
    expect(data.sections[1]!.subsections[0]!.body).toBe("Parses markdown.");
  });
});

describe("section with single selector", () => {
  const doc = md`
    # Config

    ## Allowed IPs
    - 10.0.0.1
    - 10.0.0.2
  `;

  it("unwraps single selector directly", () => {
    const data = markson(doc, { ips: m.section("Allowed IPs", m.list()) }).parse();
    expect(data.ips).toEqual(["10.0.0.1", "10.0.0.2"]);
  });
});

describe("update round-trip", () => {
  const doc = md`
    # Task

    **Status:** pending
    **Assignee:** Bob

    ## Items
    - [ ] First thing
    - [ ] Second thing
  `;

  const schema = {
    title: m.title(),
    status: m.field("Status"),
    assignee: m.field("Assignee"),
    items: m.section("Items", m.tasks()),
  };

  it("updates field and tasks, preserves the rest", () => {
    const updated = markson(doc, schema)
      .update({
        status: "done",
        items: [
          { text: "First thing", checked: true },
          { text: "Second thing", checked: true },
        ],
      })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.status).toBe("done");
    expect(result.assignee).toBe("Bob");
    expect(result.items[0]!.checked).toBe(true);
    expect(result.items[1]!.checked).toBe(true);
  });
});

describe("empty / missing sections", () => {
  const doc = md`
    # Doc
    Some text.
  `;

  it("returns empty defaults for missing content", () => {
    const data = markson(doc, {
      title: m.title(),
      items: m.section("Nonexistent", m.list()),
      meta: m.field("Missing"),
    }).parse();
    expect(data.title).toBe("Doc");
    expect(data.items).toEqual([]);
    expect(data.meta).toBeUndefined();
  });
});
