import { describe, expect, it } from "vitest";
import { parseImportText, previewImport } from "./import-parse";

describe("previewImport", () => {
  it("counts new vs existing entities, kinds, attribute columns, relations and warnings", () => {
    const payload = parseImportText(`kind,name,description,lifecycle
Application,SAP,ERP,active
Application,New App,,plan
Interface,,no name,
# relations
from,relation,to
SAP,uses,New App
SAP,feeds,Ghost`);
    const p = previewImport(payload, [{ kind: "Application", name: "sap" }]);
    expect(p.entities).toBe(2);
    expect(p.newEntities).toBe(1);
    expect(p.existingEntities).toBe(1);
    expect(p.kinds).toEqual([{ kind: "Application", count: 2 }]);
    expect(p.attributeKeys).toEqual(["lifecycle"]);
    expect(p.relations).toBe(2);
    expect(p.warnings).toEqual(["1 row without a name will be skipped", "1 relation points at names that are neither in the file nor in the graph"]);
  });
  it("warns when nothing is recognised", () => {
    expect(previewImport(parseImportText("hello world"), []).warnings[0]).toMatch(/Nothing recognised/);
  });
});
