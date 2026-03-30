import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { markson } from "../src/index";

function fixture(name: string) {
  return readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf-8"
  );
}

describe("resume", () => {
  const resume = markson(fixture("resume.md")).parse((doc) => ({
    name: doc.title,
    role: doc.field("Role"),
    email: doc.field("Email"),
    phone: doc.field("Phone"),
    location: doc.field("Location"),
    linkedin: doc.field("LinkedIn"),
    github: doc.field("GitHub"),
    summary: doc.section("Summary").list(),
    technologies: doc.section("Technologies").text(),
    experience: doc.section("Experience").sections().map((job) => ({
      title: job.title,
      description: job.text(),
      achievements: job.list(),
      stack: job.field("Stack"),
      projects: job.sections().map((p) => ({
        title: p.title,
        description: p.text(),
        achievements: p.list(),
        stack: p.field("Stack"),
      })),
    })),
    education: doc.section("Education").text(),
    languages: doc.section("Languages").list(),
  }));

  it("extracts name and fields", () => {
    expect(resume.name).toBe("John Doe");
    expect(resume.role).toBe("Senior Fullstack Developer");
    expect(resume.email).toBe("john.doe@gmail.com");
    expect(resume.phone).toBe("+1 555 123 4567");
    expect(resume.location).toBe("New York, NY (UTC-5)");
    expect(resume.linkedin).toBe("linkedin.com/in/johndoe");
    expect(resume.github).toBe("github.com/johndoe");
  });

  it("extracts summary as list", () => {
    expect(resume.summary).toHaveLength(4);
    expect(resume.summary[0]).toContain("10 years");
  });

  it("extracts technologies as text", () => {
    expect(resume.technologies).toContain("TypeScript, Node.js, React");
  });

  it("extracts jobs", () => {
    expect(resume.experience).toHaveLength(3);
    expect(resume.experience[0]!.title).toContain("Acme Corp");
    expect(resume.experience[0]!.achievements).toHaveLength(2);
    expect(resume.experience[0]!.stack).toContain("TypeScript, Nuxt");
  });

  it("extracts nested projects under a job", () => {
    const initech = resume.experience[2]!;
    expect(initech.projects).toHaveLength(2);
    expect(initech.projects[0]!.title).toContain("Chatbot Project");
    expect(initech.projects[0]!.stack).toContain("Azure Functions");
  });

  it("extracts education and languages", () => {
    expect(resume.education).toContain("Computer Science");
    expect(resume.languages).toEqual(["English -- Native", "Spanish -- Intermediate"]);
  });
});

describe("changelog", () => {
  const changelog = markson(fixture("changelog.md")).parse((doc) => ({
    title: doc.title,
    versions: doc.sections().map((version) => ({
      version: version.title,
      categories: version.sections().map((cat) => ({
        type: cat.title,
        changes: cat.list(),
      })),
    })),
  }));

  it("extracts versions", () => {
    expect(changelog.versions).toHaveLength(3);
    expect(changelog.versions[0]!.version).toBe("[1.2.0] - 2026-03-15");
  });

  it("extracts change categories with items", () => {
    const v120 = changelog.versions[0]!;
    expect(v120.categories.map((c) => c.type)).toEqual(["Added", "Fixed", "Changed"]);
    expect(v120.categories[0]!.changes).toHaveLength(3);
    expect(v120.categories[0]!.changes[0]).toContain("New user dashboard");
  });
});

describe("recipe", () => {
  const recipe = markson(fixture("recipe.md")).parse((doc) => ({
    name: doc.title,
    description: doc.text(),
    ingredients: doc.section("Ingredients").list(),
    steps: doc.section("Steps").list(),
    notes: doc.section("Notes").list(),
  }));

  it("extracts name and description", () => {
    expect(recipe.name).toBe("Pasta Carbonara");
    expect(recipe.description).toContain("Ready in 30 minutes");
  });

  it("extracts ingredients", () => {
    expect(recipe.ingredients).toHaveLength(5);
    expect(recipe.ingredients[0]).toBe("400g spaghetti");
  });

  it("extracts steps", () => {
    expect(recipe.steps).toHaveLength(6);
    expect(recipe.steps[0]).toContain("Boil pasta");
  });

  it("extracts notes", () => {
    expect(recipe.notes).toHaveLength(3);
  });
});

describe("meeting notes", () => {
  const meeting = markson(fixture("meeting.md")).parse((doc) => ({
    title: doc.title,
    date: doc.field("Date"),
    attendees: doc.field("Attendees"),
    facilitator: doc.field("Facilitator"),
    topics: doc.section("Discussion").sections().map((topic) => ({
      title: topic.title,
      summary: topic.text(),
      details: topic.list(),
    })),
    decisions: doc.section("Decisions").list(),
    actions: doc.section("Action Items").list(),
    actionTasks: doc.section("Action Items").tasks(),
  }));

  it("extracts metadata", () => {
    expect(meeting.date).toBe("2026-03-28");
    expect(meeting.attendees).toBe("Alice, Bob, Carol, Dave");
    expect(meeting.facilitator).toBe("Alice");
  });

  it("extracts discussion topics", () => {
    expect(meeting.topics).toHaveLength(2);
    expect(meeting.topics[0]!.title).toBe("Backend API Performance");
    expect(meeting.topics[0]!.details).toHaveLength(3);
  });

  it("extracts decisions and actions", () => {
    expect(meeting.decisions).toHaveLength(3);
    expect(meeting.decisions[0]).toContain("Vitest");
    expect(meeting.actions).toHaveLength(4);
    expect(meeting.actions[0]).toContain("Bob");
  });

  it("extracts tasks with checked state", () => {
    expect(meeting.actionTasks).toHaveLength(4);
    expect(meeting.actionTasks[0]).toEqual({
      text: "Bob: Set up connection pooling monitoring dashboard by Apr 2",
      checked: false,
    });
  });
});

describe("blog post", () => {
  const post = markson(fixture("blogpost.md")).parse((doc) => ({
    title: doc.title,
    subtitle: doc.text(),
    sections: doc.sections().map((s) => ({
      heading: s.title,
      body: s.text(),
      points: s.list(),
      subsections: s.sections().map((sub) => ({
        heading: sub.title,
        body: sub.text(),
        points: sub.list(),
      })),
    })),
  }));

  it("extracts title and subtitle", () => {
    expect(post.title).toBe("Why We Switched from REST to GraphQL");
    expect(post.subtitle).toContain("practical guide");
  });

  it("extracts flat sections", () => {
    expect(post.sections.map((s) => s.heading)).toEqual([
      "The Problem",
      "What We Tried",
      "Results",
      "Recommendations",
    ]);
  });

  it("extracts nested approaches", () => {
    const tried = post.sections[1]!;
    expect(tried.subsections).toHaveLength(2);
    expect(tried.subsections[0]!.points).toHaveLength(3);
  });
});

describe("awesome list", () => {
  const awesome = markson(fixture("awesome.md")).parse((doc) => ({
    title: doc.title,
    categories: doc.sections().map((cat) => ({
      name: cat.title,
      tools: cat.list(),
      links: cat.links(),
    })),
  }));

  it("extracts categories", () => {
    expect(awesome.categories.map((c) => c.name)).toEqual([
      "Build Tools",
      "Testing",
      "Frameworks",
      "Developer Experience",
    ]);
  });

  it("extracts tools per category", () => {
    expect(awesome.categories[0]!.tools).toHaveLength(3);
    expect(awesome.categories[0]!.tools[0]).toContain("esbuild");
  });

  it("extracts links from list items", () => {
    const buildLinks = awesome.categories[0]!.links;
    expect(buildLinks).toHaveLength(3);
    expect(buildLinks[0]).toEqual({ text: "esbuild", url: "https://esbuild.github.io/" });
    expect(buildLinks[1]).toEqual({ text: "tsup", url: "https://tsup.egoist.dev/" });
  });
});

describe("frontmatter", () => {
  const post = markson(fixture("blogpost-fm.md")).parse((doc) => ({
    title: doc.title,
    meta: doc.frontmatter<{
      title: string;
      date: string;
      tags: string[];
      draft: boolean;
    }>(),
    sections: doc.sections().map((s) => s.title),
  }));

  it("extracts typed frontmatter", () => {
    expect(post.meta?.title).toBe("You can't debug a process that returns no error message");
    expect(post.meta?.date).toBe("2026-03-30");
    expect(post.meta?.tags).toEqual(["JobSearch", "SoftwareEngineering", "Hiring", "CareerDev"]);
    expect(post.meta?.draft).toBe(false);
  });

  it("still parses content normally", () => {
    expect(post.title).toBe("You can't debug a process that returns no error message");
    expect(post.sections).toEqual(["The strange part", "Why it matters"]);
  });

  it("returns undefined when no frontmatter", () => {
    const doc = markson(fixture("recipe.md")).parse();
    expect(doc.frontmatter()).toBeUndefined();
  });
});

describe("case-insensitive section lookup", () => {
  const recipe = markson(fixture("recipe.md")).parse();

  it("finds section regardless of case", () => {
    expect(recipe.section("ingredients").list()).toHaveLength(5);
    expect(recipe.section("INGREDIENTS").list()).toHaveLength(5);
    expect(recipe.section("Ingredients").list()).toHaveLength(5);
  });
});

describe("at() path shorthand", () => {
  const resume = markson(fixture("resume.md")).parse();

  it("traverses nested sections", () => {
    const project = resume.at("Experience", "Initech -- Senior Software Engineer / Team Lead, Jul 2019 -- Mar 2022", "Chatbot Project -- Senior Software Engineer, Oct 2021 -- Mar 2022");
    expect(project.title).toContain("Chatbot");
    expect(project.field("Stack")).toContain("Azure Functions");
  });

  it("returns empty section on missing path", () => {
    const missing = resume.at("Experience", "Nonexistent", "Deep");
    expect(missing.title).toBe("");
    expect(missing.list()).toEqual([]);
  });

  it("works with single segment (same as section)", () => {
    expect(resume.at("Education").text()).toContain("Computer Science");
  });
});

describe("text() excludes field paragraphs", () => {
  it("does not include **Key:** value lines in text()", () => {
    const doc = markson(fixture("meeting.md")).parse();
    const text = doc.text();
    expect(text).not.toContain("Date:");
    expect(text).not.toContain("Attendees:");
    expect(text).not.toContain("Facilitator:");
  });
});

describe("parse without mapper", () => {
  const doc = markson(fixture("recipe.md")).parse();

  it("returns a Section directly", () => {
    expect(doc.title).toBe("Pasta Carbonara");
    expect(doc.section("Ingredients").list()).toHaveLength(5);
  });
});

describe("table", () => {
  const team = markson(fixture("team.md")).parse((doc) => ({
    members: doc.section("Members").table(),
    stack: doc.section("Tech Stack").table(),
  }));

  it("extracts table rows as records", () => {
    expect(team.members).toEqual([
      { Name: "Alice", Role: "Engineer", Team: "Platform" },
      { Name: "Bob", Role: "Designer", Team: "Product" },
      { Name: "Carol", Role: "PM", Team: "Product" },
    ]);
  });

  it("extracts multiple tables from different sections", () => {
    expect(team.stack).toHaveLength(3);
    expect(team.stack[0]).toEqual({ Technology: "TypeScript", Version: "5.4", Status: "Active" });
    expect(team.stack[2]).toEqual({ Technology: "Vue", Version: "3.4", Status: "Deprecated" });
  });

  it("returns empty array when no tables", () => {
    const doc = markson(fixture("recipe.md")).parse();
    expect(doc.section("Ingredients").table()).toEqual([]);
  });
});

describe("code blocks", () => {
  it("extracts code from a section", () => {
    const md = `# Setup

Install dependencies:

\`\`\`bash
pnpm install
\`\`\`

Then build:

\`\`\`ts
import { markson } from "markson";
\`\`\`
`;
    const doc = markson(md).parse();
    expect(doc.code()).toEqual(["pnpm install", 'import { markson } from "markson";']);
  });

  it("returns empty array when no code blocks", () => {
    const doc = markson(fixture("recipe.md")).parse();
    expect(doc.section("Ingredients").code()).toEqual([]);
  });
});
