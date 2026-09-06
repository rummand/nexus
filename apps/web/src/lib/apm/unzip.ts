import { inflateRawSync } from "node:zlib";

/**
 * Just enough ZIP to read a .docx and an .xlsx.
 *
 * Both are zip archives of XML, and both are exactly what somebody hands you when you ask for
 * "the application list" — an old spreadsheet and a Word document from a governance review. Adding
 * a dependency to open two well-specified containers seemed a worse trade than eighty lines that
 * do only what we need and can be read in one sitting.
 *
 * It walks the central directory rather than scanning for local headers: an entry written with a
 * streaming writer has zero sizes in its local header, and the central directory always has the
 * truth. Zip64 is not supported — an archive over 4GB is not a spreadsheet somebody emailed.
 */

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Read the whole archive. Throws with a readable message on anything it does not understand. */
export function unzip(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer);
  if (eocd < 0) throw new Error("that does not look like a zip archive");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== CENTRAL_SIG) break;
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const nameLen = buffer.readUInt16LE(at + 28);
    const extraLen = buffer.readUInt16LE(at + 30);
    const commentLen = buffer.readUInt16LE(at + 32);
    const localAt = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;

    // The local header's own name and extra lengths are authoritative for where the data starts:
    // writers routinely put different extra fields in the two places.
    const localNameLen = buffer.readUInt16LE(localAt + 26);
    const localExtraLen = buffer.readUInt16LE(localAt + 28);
    const start = localAt + 30 + localNameLen + localExtraLen;
    const raw = buffer.subarray(start, start + compressed);
    if (name.endsWith("/")) continue;
    if (method === 0) out.push({ name, data: Buffer.from(raw) });
    else if (method === 8) out.push({ name, data: inflateRawSync(raw) });
    else throw new Error(`this archive uses a compression method we cannot read (${method})`);
  }
  return out;
}

/** One entry by name, or null. */
export function entry(entries: ZipEntry[], name: string): string | null {
  const hit = entries.find((e) => e.name === name);
  return hit ? hit.data.toString("utf8") : null;
}

function findEocd(buffer: Buffer): number {
  // The end-of-central-directory record is last, but a zip comment can follow it (max 65535).
  const from = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= from; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}
