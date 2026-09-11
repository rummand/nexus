import { describe, expect, it } from "vitest";
import { claimsFromDiagram, promptFor } from "./diagram";

/**
 * What a model says about a picture, before any of it is believed (§5.91).
 *
 * Every case here is a way a vision model actually goes wrong on an architecture slide: it names
 * an arrowhead, it draws a line to something it never listed, it reads the legend as systems, it
 * reads the same box twice because the label wraps.
 */

describe("reading an architecture out of a picture", () => {
  it("turns boxes into claims, with the label as drawn", () => {
    const { claims } = claimsFromDiagram({
      objects: [
        { name: "SAP PM", kind: "Application", description: "Work orders" },
        { name: "Data Lake", kind: "Data Object" },
      ],
    }, "landscape.png");
    expect(claims.map((c) => c.name)).toEqual(["SAP PM", "Data Lake"]);
    expect(claims[0]!.description).toBe("Work orders");
    expect(claims[0]!.confidence).toBe("read from a diagram");
  });

  it("drops a shape with no readable label, and says how many", () => {
    const read = claimsFromDiagram({ objects: [{ name: "SAP PM" }, { name: "   " }, { kind: "Application" }] }, "d.png");
    expect(read.claims).toHaveLength(1);
    expect(read.note).toContain("2 shapes had no readable label");
  });

  it("reads the same box twice as one box", () => {
    const read = claimsFromDiagram({ objects: [{ name: "SAP  PM" }, { name: "sap pm" }] }, "d.png");
    expect(read.claims).toHaveLength(1);
  });

  it("keeps a line between two boxes it named", () => {
    const { claims } = claimsFromDiagram({
      objects: [{ name: "SAP PM" }, { name: "Data Lake" }],
      relations: [{ from: "SAP PM", to: "Data Lake", kind: "sends data to" }],
    }, "landscape.png");
    expect(claims[0]!.relations).toEqual([
      { kind: "sends data to", target: "Data Lake", quote: 'a line from “SAP PM” to “Data Lake” in landscape.png' },
    ]);
  });

  it("drops a line into thin air rather than inventing the other end", () => {
    const read = claimsFromDiagram({
      objects: [{ name: "SAP PM" }],
      relations: [{ from: "SAP PM", to: "Something Never Drawn" }, { from: "Ghost", to: "SAP PM" }],
    }, "d.png");
    expect(read.claims[0]!.relations).toHaveLength(0);
    expect(read.note).toContain("2 lines did not join two boxes");
  });

  it("drops a line from a box to itself", () => {
    const { claims } = claimsFromDiagram({
      objects: [{ name: "SAP PM" }],
      relations: [{ from: "SAP PM", to: "SAP PM" }],
    }, "d.png");
    expect(claims[0]!.relations).toHaveLength(0);
  });

  it("names an unlabelled line rather than leaving it blank", () => {
    const { claims } = claimsFromDiagram({
      objects: [{ name: "A" }, { name: "B" }],
      relations: [{ from: "A", to: "B" }],
    }, "d.png");
    expect(claims[0]!.relations[0]!.kind).toBe("connects to");
  });

  it("reads a swimlane as containment, which is what being drawn inside something means", () => {
    const { claims } = claimsFromDiagram({
      objects: [{ name: "Metering", group: "Grid Services" }],
    }, "capabilities.png");
    expect(claims[0]!.relations[0]).toMatchObject({ kind: "part of", target: "Grid Services" });
  });

  it("ignores a box that says it is inside itself", () => {
    const { claims } = claimsFromDiagram({ objects: [{ name: "Metering", group: "metering" }] }, "d.png");
    expect(claims[0]!.relations).toHaveLength(0);
  });

  it("stops at a sane number of boxes: four hundred means it has misread a table", () => {
    const objects = Array.from({ length: 400 }, (_, i) => ({ name: `Box ${i}` }));
    expect(claimsFromDiagram({ objects }, "d.png").claims.length).toBeLessThanOrEqual(120);
  });

  it("survives an answer of the wrong shape entirely", () => {
    expect(claimsFromDiagram({} as never, "d.png").claims).toEqual([]);
    expect(claimsFromDiagram({ objects: "not an array" } as never, "d.png").claims).toEqual([]);
    expect(claimsFromDiagram({ objects: [{ name: 7 }] } as never, "d.png").claims).toEqual([]);
  });

  it("passes the model's own sentence on, and counts what it read", () => {
    const read = claimsFromDiagram({ objects: [{ name: "A" }], note: "A C4 container diagram." }, "d.png");
    expect(read.note).toContain("Read 1 object and 0 connections");
    expect(read.note).toContain("A C4 container diagram.");
  });
});

describe("what the model is asked", () => {
  it("offers the vocabulary the workspace already uses", () => {
    const prompt = promptFor({ name: "landscape.png", mediaType: "image/png", data: "" }, ["Application", "Capability"]);
    expect(prompt).toContain("landscape.png");
    expect(prompt).toContain("Application, Capability");
  });

  it("says so plainly when there is no vocabulary yet", () => {
    expect(promptFor({ name: "d.png", mediaType: "image/png", data: "" }, [])).toContain("no type vocabulary yet");
  });
});
