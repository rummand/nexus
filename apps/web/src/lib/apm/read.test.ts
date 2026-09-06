import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decode, delimited, excelDate, formatOf, fromDocx, fromXlsx, readFile } from "./read";
import { unzip } from "./unzip";

/**
 * Reading what people actually hand you.
 *
 * Every case here is one that has really cost somebody an afternoon: a description column with a
 * comma in it, a decade-old export in UTF-16, a ServiceNow reference field that is an object rather
 * than a string, a workbook with three sheets, a date that is a five-digit number. An import
 * feature that only accepts the clean file is an import feature nobody can use.
 */

/** A zip, built by hand, so the readers are tested against real bytes rather than a mock. */
function zip(files: Array<{ name: string; body: string; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const raw = Buffer.from(file.body, "utf8");
    const data = file.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(file.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(file.deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(file.deflate ? 8 : 0, 10);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += 30 + name.length + data.length;
  }
  const body = Buffer.concat(locals);
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, dir, end]);
}

describe("delimited exports", () => {
  it("keeps a comma that is inside a quoted description", () => {
    const { headers, rows } = delimited('name,description\nMaximo,"Work orders, permits and parts"\n', ",");
    expect(headers).toEqual(["name", "description"]);
    expect(rows).toEqual([["Maximo", "Work orders, permits and parts"]]);
  });

  it("survives a newline and a doubled quote inside a field", () => {
    const { rows } = delimited('name,note\nSCADA,"line one\nline two, with ""quotes"" in it"\n', ",");
    expect(rows).toEqual([["SCADA", 'line one\nline two, with "quotes" in it']]);
  });

  it("reads CRLF, and pads a short row rather than shifting the columns", () => {
    const { rows } = delimited("a,b,c\r\n1,2,3\r\n4,5\r\n", ",");
    expect(rows).toEqual([["1", "2", "3"], ["4", "5", ""]]);
  });

  it("names an unnamed column rather than losing it", () => {
    const { headers } = delimited("name,,owner\nx,y,z\n", ",");
    expect(headers).toEqual(["name", "column 2", "owner"]);
  });
});

describe("bytes that are not plain UTF-8", () => {
  it("strips a UTF-8 byte-order mark, which otherwise poisons the first column name", () => {
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("name,owner\nMaximo,IT\n")]);
    const file = readFile("export.csv", buffer);
    expect(file.shape === "table" && file.headers[0]).toBe("name");
  });

  it("reads a UTF-16 export, which is what a decade-old Windows dump often is", () => {
    const text = "name,owner\nMaximo,IT\n";
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect(decode(buffer)).toBe(text);
  });
});

describe("a ServiceNow JSON export", () => {
  it("finds the records inside the wrapper, and reads a reference field's readable half", () => {
    const body = JSON.stringify({
      result: [
        { name: "Maximo", u_owner: { value: "u1", display_value: "Asset Management" }, install_status: 1 },
        { name: "SCADA", u_owner: { value: "u2", display_value: "Grid Operations" }, criticality: "high" },
      ],
    });
    const file = readFile("apps.json", Buffer.from(body));
    if (file.shape !== "table") throw new Error("expected a table");
    expect(file.headers).toEqual(["name", "u_owner", "install_status", "criticality"]);
    expect(file.rows[0]).toEqual(["Maximo", "Asset Management", "1", ""]);
    expect(file.rows[1]).toEqual(["SCADA", "Grid Operations", "", "high"]);
  });

  it("says so plainly when the JSON is not a list of records", () => {
    expect(() => readFile("x.json", Buffer.from('{"a":1}'))).toThrow(/not a list of records/);
    expect(() => readFile("x.json", Buffer.from("not json"))).toThrow(/not valid JSON/);
  });
});

describe("an old spreadsheet", () => {
  const sheet = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>45292</v></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>Historian &amp; PI</t></is></c><c r="C3"><v>45658</v></c></row>
  </sheetData></worksheet>`;
  const strings = `<sst><si><t>Name</t></si><si><t>Owner</t></si><si><t>End of support</t></si><si><t>Maximo</t></si><si><t>Asset Management</t></si></sst>`;
  const workbook = `<workbook><sheets><sheet name="Applications" sheetId="1"/><sheet name="Notes" sheetId="2"/></sheets></workbook>`;
  const book = zip([
    { name: "xl/workbook.xml", body: workbook },
    { name: "xl/sharedStrings.xml", body: strings },
    { name: "xl/worksheets/sheet1.xml", body: sheet, deflate: true },
    { name: "xl/worksheets/sheet2.xml", body: "<worksheet/>" },
  ]);

  it("reads the first sheet, shared strings, inline strings and entities", () => {
    const { headers, rows } = fromXlsx(book);
    expect(headers).toEqual(["Name", "Owner", "End of support"]);
    expect(rows[0]).toEqual(["Maximo", "Asset Management", "45292"]);
    expect(rows[1]).toEqual(["Historian & PI", "", "45658"]);
  });

  it("says which sheet it read when a workbook has several", () => {
    const { sheets, note } = fromXlsx(book);
    expect(sheets).toEqual(["Applications", "Notes"]);
    expect(note).toMatch(/Only the first sheet .*Applications.*this workbook has 2/);
  });

  it("leaves a date as the number it is stored as, and converts it when asked", () => {
    // 45292 is what Excel shows as 01/01/2024 — guessing without the number format would turn a
    // headcount into a date, so the conversion waits until a person maps the column.
    expect(excelDate(45292)).toBe("2024-01-01");
    expect(excelDate(45658)).toBe("2025-01-01");
    expect(excelDate(0)).toBeNull();
    expect(excelDate(Number.NaN)).toBeNull();
  });

  it("is recognised from its bytes when the file has no useful extension", () => {
    expect(formatOf("download", book)).toBe("xlsx");
  });
});

describe("a Word document", () => {
  const docx = zip([{
    name: "word/document.xml",
    body: `<w:document><w:body>
      <w:p><w:r><w:t>Application review</w:t></w:r></w:p>
      <w:p><w:r><w:t>Maximo is out of support</w:t></w:r><w:r><w:t xml:space="preserve"> from December.</w:t></w:r></w:p>
      <w:p/>
      <w:p><w:r><w:t>Owner:</w:t></w:r><w:tab/><w:r><w:t>Asset Management &amp; Ops</w:t></w:r></w:p>
    </w:body></w:document>`,
    deflate: true,
  }]);

  it("comes out as prose, with paragraphs kept and the markup gone", () => {
    const text = fromDocx(docx);
    expect(text).toBe("Application review\nMaximo is out of support from December.\n\nOwner:\tAsset Management & Ops");
  });

  it("arrives as text rather than a table, so it goes to extraction rather than to columns", () => {
    const file = readFile("review.docx", docx);
    expect(file.shape).toBe("text");
    expect(file.format).toBe("docx");
  });

  it("says so plainly when the archive is not a document we can read", () => {
    expect(() => fromDocx(zip([{ name: "other.xml", body: "<x/>" }]))).toThrow(/no document body/);
    expect(() => unzip(Buffer.from("not a zip at all"))).toThrow(/does not look like a zip/);
  });
});

describe("choosing how to read a file", () => {
  it("goes by extension first, and by content when there is none to trust", () => {
    expect(formatOf("export.CSV", Buffer.from(""))).toBe("csv");
    expect(formatOf("notes.md", Buffer.from(""))).toBe("markdown");
    expect(formatOf("dump", Buffer.from('[{"a":1}]'))).toBe("json");
    expect(formatOf("dump", Buffer.from("a\tb\n1\t2"))).toBe("tsv");
    expect(formatOf("dump", Buffer.from("a,b\n1,2"))).toBe("csv");
    expect(formatOf("dump", Buffer.from("just some prose about the estate"))).toBe("text");
  });
});
