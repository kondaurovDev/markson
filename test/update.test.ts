import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { markson, m } from "../src/index";

function fixture(name: string) {
  return readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf-8"
  );
}

describe("update: field", () => {
  const schema = {
    title: m.title(),
    date: m.field("Date"),
    attendees: m.field("Attendees"),
  };

  it("updates a field value and round-trips", () => {
    const updated = markson(fixture("meeting.md"), schema)
      .update({ date: "2026-04-01" })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.date).toBe("2026-04-01");
    expect(result.attendees).toBe("Alice, Bob, Carol, Dave");
    expect(result.title).toContain("Sprint Review");
  });
});

describe("update: tasks", () => {
  const schema = {
    actions: m.section("Action Items", m.tasks()),
  };

  it("checks a task and round-trips", () => {
    const original = markson(fixture("meeting.md"), schema).parse();
    expect(original.actions[0]!.checked).toBe(false);

    const updated = markson(fixture("meeting.md"), schema)
      .update({
        actions: [
          { text: "Bob: Set up connection pooling monitoring dashboard by Apr 2", checked: true },
          { text: "Carol: Write migration guide for /v1 to /v2 by Apr 5", checked: false },
          { text: "Dave: Schedule App Store release for Apr 1", checked: true },
          { text: "Alice: Update sprint board with new velocity metrics", checked: false },
        ],
      })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.actions[0]!.checked).toBe(true);
    expect(result.actions[1]!.checked).toBe(false);
    expect(result.actions[2]!.checked).toBe(true);
  });
});

describe("update: list", () => {
  const schema = {
    name: m.title(),
    ingredients: m.section("Ingredients", m.list()),
    steps: m.section("Steps", m.list()),
  };

  it("replaces list items and round-trips", () => {
    const updated = markson(fixture("recipe.md"), schema)
      .update({ ingredients: ["flour", "sugar", "butter"] })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.ingredients).toEqual(["flour", "sugar", "butter"]);
    expect(result.steps).toHaveLength(6);
    expect(result.name).toBe("Pasta Carbonara");
  });
});

describe("update: title", () => {
  const schema = {
    name: m.title(),
    description: m.text(),
  };

  it("updates title and round-trips", () => {
    const updated = markson(fixture("recipe.md"), schema)
      .update({ name: "Spaghetti Aglio e Olio" })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.name).toBe("Spaghetti Aglio e Olio");
    expect(result.description).toContain("Ready in 30 minutes");
  });
});

describe("update: text", () => {
  const schema = {
    name: m.title(),
    description: m.text(),
  };

  it("updates text and round-trips", () => {
    const updated = markson(fixture("recipe.md"), schema)
      .update({ description: "A quick weeknight dinner." })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.description).toBe("A quick weeknight dinner.");
    expect(result.name).toBe("Pasta Carbonara");
  });
});

describe("update: frontmatter", () => {
  const schema = {
    title: m.title(),
    meta: m.frontmatter<{ title: string; date: string; tags: string[]; draft: boolean }>(),
  };

  it("updates frontmatter and round-trips", () => {
    const updated = markson(fixture("blogpost-fm.md"), schema)
      .update({ meta: { title: "Updated Title", date: "2026-04-01", tags: ["Tech"], draft: false } })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.meta?.draft).toBe(false);
    expect(result.meta?.date).toBe("2026-04-01");
    expect(result.meta?.tags).toEqual(["Tech"]);
    expect(result.title).toContain("debug");
  });
});

describe("update: nested section", () => {
  const schema = {
    title: m.title(),
    date: m.field("Date"),
    decisions: m.section("Decisions", m.list()),
  };

  it("updates a nested section list and round-trips", () => {
    const updated = markson(fixture("meeting.md"), schema)
      .update({ decisions: ["Use markson for all things", "Ship it"] })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.decisions).toEqual(["Use markson for all things", "Ship it"]);
    expect(result.date).toBe("2026-03-28");
  });
});

describe("update: sections with title as key", () => {
  const schema = {
    versions: m.sections({
      version: m.title(),
      categories: m.sections({
        type: m.title(),
        changes: m.list(),
      }),
    }),
  };

  it("updates a specific version's category by title matching", () => {
    const updated = markson(fixture("changelog.md"), schema)
      .update({
        versions: [
          {
            version: "[1.2.0] - 2026-03-15",
            categories: [
              { type: "Added", changes: ["Schema API", "Update engine", "Stringify"] },
            ],
          },
        ],
      })
      .stringify();

    const result = markson(updated, schema).parse();
    const v120 = result.versions.find((v) => v.version === "[1.2.0] - 2026-03-15")!;
    expect(v120.categories.find((c) => c.type === "Added")!.changes).toEqual([
      "Schema API", "Update engine", "Stringify",
    ]);
    expect(result.versions.find((v) => v.version === "[1.1.0] - 2026-02-01")).toBeDefined();
  });
});

describe("update: chaining", () => {
  const schema = {
    name: m.title(),
    ingredients: m.section("Ingredients", m.list()),
  };

  it("chains multiple updates", () => {
    const updated = markson(fixture("recipe.md"), schema)
      .update({ name: "New Recipe" })
      .update({ ingredients: ["salt", "pepper"] })
      .stringify();

    const result = markson(updated, schema).parse();
    expect(result.name).toBe("New Recipe");
    expect(result.ingredients).toEqual(["salt", "pepper"]);
  });
});
