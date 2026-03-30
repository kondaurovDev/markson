import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "node:fs";
import { markson, m, type Infer } from "../src/index";

function fixture(name: string) {
  return readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf-8"
  );
}

describe("schema: recipe", () => {
  const recipeSchema = {
    name: m.title(),
    description: m.text(),
    ingredients: m.section("Ingredients", m.list()),
    steps: m.section("Steps", m.list()),
    notes: m.section("Notes", m.list()),
  };

  const recipe = markson(fixture("recipe.md")).parse(recipeSchema);

  it("infers correct types", () => {
    expectTypeOf(recipe.name).toBeString();
    expectTypeOf(recipe.description).toBeString();
    expectTypeOf(recipe.ingredients).toEqualTypeOf<string[]>();
    expectTypeOf(recipe.steps).toEqualTypeOf<string[]>();
  });

  it("extracts name and description", () => {
    expect(recipe.name).toBe("Pasta Carbonara");
    expect(recipe.description).toContain("Ready in 30 minutes");
  });

  it("extracts ingredients via section selector", () => {
    expect(recipe.ingredients).toHaveLength(5);
    expect(recipe.ingredients[0]).toBe("400g spaghetti");
  });

  it("extracts steps", () => {
    expect(recipe.steps).toHaveLength(6);
    expect(recipe.steps[0]).toContain("Boil pasta");
  });
});

describe("schema: changelog", () => {
  const changelogSchema = {
    title: m.title(),
    versions: m.sections({
      version: m.title(),
      categories: m.sections({
        type: m.title(),
        changes: m.list(),
      }),
    }),
  };

  const changelog = markson(fixture("changelog.md")).parse(changelogSchema);

  it("infers nested array types", () => {
    expectTypeOf(changelog.versions).toEqualTypeOf<
      Array<{ version: string; categories: Array<{ type: string; changes: string[] }> }>
    >();
  });

  it("extracts versions", () => {
    expect(changelog.versions).toHaveLength(3);
    expect(changelog.versions[0]!.version).toBe("[1.2.0] - 2026-03-15");
  });

  it("extracts nested categories", () => {
    const v120 = changelog.versions[0]!;
    expect(v120.categories.map((c) => c.type)).toEqual(["Added", "Fixed", "Changed"]);
    expect(v120.categories[0]!.changes).toHaveLength(3);
    expect(v120.categories[0]!.changes[0]).toContain("New user dashboard");
  });
});

describe("schema: resume", () => {
  const projectSchema = {
    title: m.title(),
    description: m.text(),
    achievements: m.list(),
    stack: m.field("Stack"),
  };

  const resumeSchema = {
    name: m.title(),
    role: m.field("Role"),
    email: m.field("Email"),
    phone: m.field("Phone"),
    location: m.field("Location"),
    linkedin: m.field("LinkedIn"),
    github: m.field("GitHub"),
    summary: m.section("Summary", m.list()),
    technologies: m.section("Technologies", m.text()),
    experience: m.section("Experience", m.sections({
      title: m.title(),
      description: m.text(),
      achievements: m.list(),
      stack: m.field("Stack"),
      projects: m.sections(projectSchema),
    })),
    education: m.section("Education", m.text()),
    languages: m.section("Languages", m.list()),
  };

  const resume = markson(fixture("resume.md")).parse(resumeSchema);

  it("extracts fields", () => {
    expect(resume.name).toBe("John Doe");
    expect(resume.role).toBe("Senior Fullstack Developer");
    expect(resume.email).toBe("john.doe@gmail.com");
  });

  it("extracts nested experience", () => {
    expect(resume.experience).toHaveLength(3);
    expect(resume.experience[0]!.title).toContain("Acme Corp");
    expect(resume.experience[0]!.stack).toContain("TypeScript, Nuxt");
  });

  it("extracts deeply nested projects", () => {
    const initech = resume.experience[2]!;
    expect(initech.projects).toHaveLength(2);
    expect(initech.projects[0]!.title).toContain("Chatbot");
    expect(initech.projects[0]!.stack).toContain("Azure Functions");
  });

  it("extracts simple sections", () => {
    expect(resume.summary).toHaveLength(4);
    expect(resume.technologies).toContain("TypeScript, Node.js, React");
    expect(resume.education).toContain("Computer Science");
    expect(resume.languages).toEqual(["English -- Native", "Spanish -- Intermediate"]);
  });
});

describe("schema: meeting notes", () => {
  const meetingSchema = {
    title: m.title(),
    date: m.field("Date"),
    attendees: m.field("Attendees"),
    facilitator: m.field("Facilitator"),
    topics: m.section("Discussion", m.sections({
      title: m.title(),
      summary: m.text(),
      details: m.list(),
    })),
    decisions: m.section("Decisions", m.list()),
    actions: m.section("Action Items", m.tasks()),
  };

  const meeting = markson(fixture("meeting.md")).parse(meetingSchema);

  it("extracts fields", () => {
    expect(meeting.date).toBe("2026-03-28");
    expect(meeting.attendees).toBe("Alice, Bob, Carol, Dave");
    expect(meeting.facilitator).toBe("Alice");
  });

  it("extracts discussion topics via nested sections", () => {
    expect(meeting.topics).toHaveLength(2);
    expect(meeting.topics[0]!.title).toBe("Backend API Performance");
    expect(meeting.topics[0]!.details).toHaveLength(3);
  });

  it("extracts tasks", () => {
    expect(meeting.actions).toHaveLength(4);
    expect(meeting.actions[0]!.checked).toBe(false);
    expect(meeting.actions[0]!.text).toContain("Bob");
  });

  it("infers task types", () => {
    expectTypeOf(meeting.actions).toEqualTypeOf<
      Array<{ text: string; checked: boolean }>
    >();
  });
});

describe("schema: awesome list", () => {
  const awesomeSchema = {
    title: m.title(),
    categories: m.sections({
      name: m.title(),
      tools: m.list(),
      links: m.links(),
    }),
  };

  const awesome = markson(fixture("awesome.md")).parse(awesomeSchema);

  it("extracts categories", () => {
    expect(awesome.categories.map((c) => c.name)).toEqual([
      "Build Tools", "Testing", "Frameworks", "Developer Experience",
    ]);
  });

  it("extracts links", () => {
    const buildLinks = awesome.categories[0]!.links;
    expect(buildLinks).toHaveLength(3);
    expect(buildLinks[0]).toEqual({ text: "esbuild", url: "https://esbuild.github.io/" });
  });
});

describe("schema: blog post with frontmatter", () => {
  const blogSchema = {
    title: m.title(),
    meta: m.frontmatter<{ title: string; date: string; tags: string[]; draft: boolean }>(),
    subtitle: m.text(),
    sections: m.sections({
      heading: m.title(),
      body: m.text(),
    }),
  };

  const post = markson(fixture("blogpost-fm.md")).parse(blogSchema);

  it("extracts frontmatter", () => {
    expect(post.meta?.title).toBe("You can't debug a process that returns no error message");
    expect(post.meta?.date).toBe("2026-03-30");
    expect(post.meta?.tags).toEqual(["JobSearch", "SoftwareEngineering", "Hiring", "CareerDev"]);
    expect(post.meta?.draft).toBe(false);
  });

  it("extracts content alongside frontmatter", () => {
    expect(post.title).toBe("You can't debug a process that returns no error message");
    expect(post.sections).toHaveLength(2);
  });
});

describe("schema: table", () => {
  const teamSchema = {
    title: m.title(),
    members: m.section("Members", m.table()),
    stack: m.section("Tech Stack", m.table()),
  };

  const team = markson(fixture("team.md")).parse(teamSchema);

  it("extracts table rows", () => {
    expect(team.members).toEqual([
      { Name: "Alice", Role: "Engineer", Team: "Platform" },
      { Name: "Bob", Role: "Designer", Team: "Product" },
      { Name: "Carol", Role: "PM", Team: "Product" },
    ]);
  });

  it("extracts tables from different sections", () => {
    expect(team.stack).toHaveLength(3);
    expect(team.stack[0]).toEqual({ Technology: "TypeScript", Version: "5.4", Status: "Active" });
  });
});

describe("schema: markson.schema() factory", () => {
  const schema = markson.schema(({ title, text, section, list }) => ({
    name: title(),
    description: text(),
    ingredients: section("Ingredients", list()),
  }));

  it("works the same as inline schema", () => {
    const recipe = markson(fixture("recipe.md"), schema).parse();
    expect(recipe.name).toBe("Pasta Carbonara");
    expect(recipe.ingredients).toHaveLength(5);
  });
});

describe("schema: Infer type export", () => {
  it("infers correct type from schema", () => {
    const schema = {
      name: m.title(),
      items: m.list(),
      email: m.field("Email"),
    };
    type Result = Infer<typeof schema>;
    expectTypeOf<Result>().toEqualTypeOf<{
      name: string;
      items: string[];
      email: string | undefined;
    }>();
  });
});
