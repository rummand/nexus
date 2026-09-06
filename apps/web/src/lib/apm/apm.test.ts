import { describe, expect, it } from "vitest";
import { dateOrder, describeRole, proposeMapping, toIsoDate } from "./map";
import { conflicts, flatten, stage, type FileInput } from "./stage";
import { changesAgainst, matchRecord, similarity, KEY_ATTRIBUTE, type MatchTarget } from "./match";
import { accepted, review } from "./review";

/**
 * The landing zone, before anything is written.
 *
 * Every case here is a way real data goes wrong: a spreadsheet whose dates are five-digit numbers,
 * two exports that disagree about who owns a system, a name that is nearly but not quite a name in
 * the graph, a row that vanished from this month's export. The rule the whole feature rests on is
 * that none of these becomes a silent decision.
 */

const file = (name: string, headers: string[], rows: string[][]): FileInput =>
  ({ name, headers, rows, columns: proposeMapping(headers, rows) });

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): MatchTarget =>
  ({ id, name, kind, attributes });

describe("proposing what the columns mean", () => {
  const columns = proposeMapping(
    ["sys_id", "Name", "Class", "Short description", "Business owner", "End of support", "Depends on", "sys_created_on", "Empty"],
    [
      ["INC001", "Maximo", "Application", "Work orders", "Jane Olsen", "2027-12-01", "SAP PM, Data Lake", "2019-01-01", ""],
      ["INC002", "SCADA", "Application", "Grid control", "erik@acme.example", "2029-06-01", "Historian", "2019-01-01", ""],
    ],
  );
  const roleOf = (header: string) => describeRole(columns.find((c) => c.header === header)!.role);

  it("reads the obvious ones from their headers", () => {
    expect(roleOf("Name")).toBe("name");
    expect(roleOf("Class")).toBe("kind");
    expect(roleOf("Short description")).toBe("description");
    expect(roleOf("sys_id")).toBe("source key");
    expect(roleOf("End of support")).toBe("date · end of support");
    expect(roleOf("Depends on")).toBe("relation · depends on");
  });

  it("keeps people apart from ordinary attributes", () => {
    expect(roleOf("Business owner")).toBe("person · business owner");
  });

  it("ignores audit noise and columns nobody filled in", () => {
    expect(roleOf("sys_created_on")).toBe("ignored");
    expect(roleOf("Empty")).toBe("ignored");
  });

  it("says why, quoting the header, for every column", () => {
    for (const column of columns) expect(column.why.length).toBeGreaterThan(10);
    expect(columns.find((c) => c.header === "End of support")!.why).toMatch(/2 of 2 values read as dates/);
  });

  it("finds the name by looking at the values when no header announces one", () => {
    const guessed = proposeMapping(
      ["u_col_1", "u_col_2"],
      [["Maximo", "active"], ["SCADA", "active"], ["Historian", "retired"]],
    );
    expect(describeRole(guessed[0]!.role)).toBe("name");
    expect(guessed[0]!.why).toMatch(/almost always different/);
    expect(describeRole(guessed[1]!.role)).toBe("attribute · u col 2");
  });
});

describe("dates, which is where old spreadsheets go wrong", () => {
  it("reads the forms an export actually contains", () => {
    expect(toIsoDate("2027-03-14", null)).toBe("2027-03-14");
    expect(toIsoDate("2027-03", null)).toBe("2027-03");
    expect(toIsoDate("45292", null)).toBe("2024-01-01"); // an Excel serial
    expect(toIsoDate("2027/03/14", null)).toBe("2027-03-14");
    expect(toIsoDate("14 March 2027", null)).toBe("2027-03-14");
    expect(toIsoDate("31/12/2027", null)).toBe("2027-12-31"); // unambiguous: 31 cannot be a month
  });

  it("settles a slash column by looking at the whole column, not one value", () => {
    expect(dateOrder(["03/04/2027", "31/12/2027"])).toBe(true); // day first
    expect(dateOrder(["03/04/2027", "12/31/2027"])).toBe(false); // month first
    expect(dateOrder(["03/04/2027", "05/06/2027"])).toBeNull(); // cannot be told
  });

  it("refuses to guess an ambiguous date rather than putting a plan a month out", () => {
    expect(toIsoDate("03/04/2027", null)).toBeNull();
    expect(toIsoDate("03/04/2027", true)).toBe("2027-04-03");
    expect(toIsoDate("03/04/2027", false)).toBe("2027-03-04");
  });
});

describe("folding several files into one set of claims", () => {
  const servicenow = file("servicenow.csv", ["sys_id", "Name", "Class", "Business owner", "Lifecycle"], [
    ["A1", "Maximo", "Application", "Jane Olsen", "active"],
    ["A2", "SCADA", "Application", "Erik Berg", "active"],
  ]);
  const sharepoint = file("sharepoint.csv", ["Name", "Lifecycle", "Criticality"], [
    ["Maximo", "phase out", "high"],
    ["Historian", "active", "medium"],
  ]);

  it("recognises the same object arriving from two files", () => {
    const records = stage([servicenow, sharepoint]);
    expect(records.map((r) => r.name)).toEqual(["Maximo", "SCADA", "Historian"]);
    expect(records[0]!.sources).toEqual(["servicenow.csv", "sharepoint.csv"]);
  });

  it("keeps both answers when the sources disagree, and lets the trust order decide", () => {
    const first = stage([servicenow, sharepoint])[0]!;
    expect(flatten(first).lifecycle).toBe("active"); // the file given first wins
    expect(conflicts(first)).toEqual([{
      key: "lifecycle",
      chosen: { value: "active", source: "servicenow.csv", column: "Lifecycle" },
      others: [{ value: "phase out", source: "sharepoint.csv", column: "Lifecycle" }],
    }]);

    // …and re-ordering the files is the whole of the mechanism
    const other = stage([sharepoint, servicenow])[0]!;
    expect(flatten(other).lifecycle).toBe("phase out");
  });

  it("does not call agreement a conflict", () => {
    const a = file("a.csv", ["Name", "Lifecycle"], [["Maximo", "active"]]);
    const b = file("b.csv", ["Name", "Lifecycle"], [["Maximo", " Active "]]);
    expect(conflicts(stage([a, b])[0]!)).toEqual([]);
  });

  it("holds people back until somebody asks for them", () => {
    const records = stage([servicenow]);
    expect(flatten(records[0]!)["business owner"]).toBeUndefined();
    expect(records[0]!.personal["business owner"]!.chosen.value).toBe("Jane Olsen");

    const included = stage([servicenow], { includePersonal: true });
    expect(flatten(included[0]!)["business owner"]).toBe("Jane Olsen");
    expect(included[0]!.personal).toEqual({});
  });

  it("reads a list in one cell as several relations", () => {
    const withLinks = file("x.csv", ["Name", "Depends on"], [["Billing", "SAP PM, Data Lake; SCADA"]]);
    expect(stage([withLinks])[0]!.relations.map((r) => r.target)).toEqual(["SAP PM", "Data Lake", "SCADA"]);
  });

  it("remembers which row of which file each claim came from", () => {
    const records = stage([servicenow, sharepoint]);
    expect(records[0]!.rows).toEqual([
      { source: "servicenow.csv", row: 2 },
      { source: "sharepoint.csv", row: 2 },
    ]);
  });
});

describe("matching against the graph", () => {
  const graph = [
    entity("e1", "Maximo", "Application", { [KEY_ATTRIBUTE]: "A1", owner: "Asset Management" }),
    entity("e2", "SCADA", "Application"),
    entity("e3", "SCADA", "IT Component"),
    entity("e4", "PI Historian", "Application"),
  ];
  const one = (headers: string[], row: string[]) => stage([file("f.csv", headers, [row])])[0]!;

  it("takes the source's own key as fact when a previous import stored it", () => {
    const match = matchRecord(one(["sys_id", "Name"], ["A1", "Maximo Renamed"]), graph);
    expect(match).toMatchObject({ how: "source key", entityId: "e1" });
  });

  it("matches on name and kind together, and offers the other one with that name", () => {
    const match = matchRecord(one(["Name", "Class"], ["SCADA", "Application"]), graph);
    expect(match).toMatchObject({ how: "name and kind", entityId: "e2" });
    expect(match.alternatives.map((a) => a.entityId)).toEqual(["e3"]);
  });

  it("refuses to pick when the graph has that name twice and nothing tells them apart", () => {
    const match = matchRecord(one(["Name"], ["SCADA"]), graph);
    expect(match.entityId).toBeNull();
    expect(match.alternatives).toHaveLength(2);
  });

  it("offers a near name as a question, never as an answer", () => {
    const match = matchRecord(one(["Name"], ["PI-Historian (prod)"]), graph);
    expect(match.how).toBe("near name");
    expect(match.entityId).toBeNull();
    expect(match.alternatives[0]!.name).toBe("PI Historian");
  });

  it("does not confuse two systems that differ by two characters", () => {
    expect(similarity("sap pm", "sap cm")).toBeLessThan(0.72);
    expect(similarity("maximo asset management", "maximo")).toBeGreaterThan(0.4);
    expect(similarity("pi historian", "pi historian")).toBe(1);
  });

  it("shows only the fields that would actually change", () => {
    const record = one(["Name", "Class", "Lifecycle"], ["Maximo", "Application", "phase out"]);
    const changes = changesAgainst(record, graph[0]!);
    expect(changes).toEqual([{ key: "lifecycle", from: "", to: "phase out" }]);
  });
});

describe("the review, and what it will not decide for you", () => {
  const graph = [entity("e1", "Maximo", "Application", { lifecycle: "active" }), entity("e4", "PI Historian")];
  const run = (f: FileInput, options: Partial<Parameters<typeof review>[2]> = {}) =>
    review(stage([f]), graph, { kinds: ["Application"], ...options });

  it("holds a row it cannot write, and says why", () => {
    const r = run(file("f.csv", ["Name", "Lifecycle"], [["", "active"], ["SCADA", "active"]]));
    const blocked = r.rows.find((row) => row.issues.some((i) => i.code === "no-name"))!;
    expect(blocked.decision).toBe("hold");
    expect(r.counts.held).toBe(1);
    expect(r.counts.create).toBe(1);
  });

  it("counts a row that changes nothing separately, so a re-import is reviewable", () => {
    const r = run(file("f.csv", ["Name", "Class", "Lifecycle"], [["Maximo", "Application", "active"]]));
    expect(r.counts).toMatchObject({ unchanged: 1, update: 0, create: 0 });
    expect(r.rows[0]!.issues.map((i) => i.code)).toContain("unchanged");
  });

  it("asks rather than decides about a near name", () => {
    const r = run(file("f.csv", ["Name"], [["PI-Historian"]]));
    expect(r.rows[0]!.issues.map((i) => i.code)).toContain("near-match");
    expect(r.rows[0]!.decision).toBe("accept"); // a question, not a blocker — but it is on the card
  });

  it("refuses a batch that names the same key twice", () => {
    const r = run(file("f.csv", ["sys_id", "Name"], [["A1", "One"], ["A1", "Two"]]));
    expect(r.rows.every((row) => row.decision === "hold")).toBe(true);
    expect(r.rows[0]!.issues.map((i) => i.code)).toContain("duplicate-key");
  });

  it("flags a connection that would go nowhere", () => {
    const r = run(file("f.csv", ["Name", "Depends on"], [["Billing", "A system nobody has"]]));
    expect(r.rows[0]!.issues.find((i) => i.code === "dangling")!.message).toMatch(/would go nowhere/);
  });

  it("does not flag a connection to something else in the same batch", () => {
    const r = run(file("f.csv", ["Name", "Depends on"], [["Billing", "Ledger"], ["Ledger", ""]]));
    expect(r.rows[0]!.issues.some((i) => i.code === "dangling")).toBe(false);
  });

  it("notices a new kind without making a fuss about it", () => {
    const r = run(file("f.csv", ["Name", "Class"], [["Kafka", "Technology Service"]]));
    const issue = r.rows[0]!.issues.find((i) => i.code === "new-kind")!;
    expect(issue.severity).toBe("note");
    expect(r.rows[0]!.decision).toBe("accept");
  });

  it("raises what the source has stopped claiming, and never deletes it", () => {
    const r = run(file("f.csv", ["Name", "Class"], [["Maximo", "Application"]]), {
      previouslyFrom: [entity("e1", "Maximo"), entity("e9", "Old Billing")],
    });
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0]!.target.name).toBe("Old Billing");
    expect(r.missing[0]!.issue.message).toMatch(/Retired, out of scope, or a filtered export\?/);
  });

  it("writes only what a person accepted", () => {
    const r = run(file("f.csv", ["Name"], [["A"], [""], ["C"]]));
    r.rows[2]!.decision = "reject";
    expect(accepted(r.rows).map((row) => row.record.name)).toEqual(["A"]);
  });
});

describe("telling a relation from an adjective", () => {
  const headers = ["Name", "Depends on", "Hosting"];
  const rows = [
    ["Maximo", "Data Lake", "on premise"],
    ["Billing", "Data Lake, Maximo", "private cloud"],
    ["Data Lake", "", "on premise"],
  ];

  it("reads a column of known names as a relation", () => {
    const columns = proposeMapping(headers, rows, { knownNames: ["Maximo", "Billing", "Data Lake"] });
    expect(describeRole(columns[1]!.role)).toBe("relation · depends on");
    expect(columns[1]!.why).toMatch(/3 of 3 are things this batch or the graph knows/);
  });

  it("reads a column that is named like one but holds adjectives as an attribute", () => {
    // "Hosting" matches the relation vocabulary, but "on premise" is not the name of anything.
    const columns = proposeMapping(headers, rows, { knownNames: ["Maximo", "Billing", "Data Lake"] });
    expect(describeRole(columns[2]!.role)).toBe("attribute · hosting");
    expect(columns[2]!.why).toMatch(/name nothing this batch or the graph has/);
  });

  it("falls back to the header when nothing is known yet, rather than losing the relation", () => {
    const columns = proposeMapping(headers, rows);
    expect(describeRole(columns[1]!.role)).toBe("relation · depends on");
  });
});
