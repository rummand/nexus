/**
 * What comes back from a LeanIX workspace (§5.62).
 *
 * Deliberately loose about fields and strict about shape. Every LeanIX workspace has a different
 * meta-model — that is the point of the product — so the fields on a fact sheet are whatever this
 * organisation configured, and a type that named them would be a type that is wrong everywhere
 * except one customer. What *is* the same everywhere is the envelope: an id, a type, a name, a
 * paged connection, and relations that carry their own type name.
 */

/** A fact sheet as the export writes it down: the envelope, plus whatever else it carried. */
export interface FactSheet {
  id: string;
  /** The LeanIX fact sheet type — "Application", "ITComponent", "BusinessCapability", … */
  type: string;
  name: string;
  displayName?: string;
  description?: string;
  /** Everything else the workspace configured, flattened to strings. */
  fields: Record<string, string>;
  tags: string[];
  /** email → role, from the subscriptions. */
  subscriptions: Array<{ email: string; role: string }>;
}

/** One modelled relationship. LeanIX names both ends and the relation type. */
export interface FactSheetRelation {
  fromId: string;
  toId: string;
  /** The LeanIX relation field, e.g. "relApplicationToITComponent". */
  type: string;
  /** Fields on the relation itself, where the workspace put any there. */
  fields: Record<string, string>;
}

/** What one run of the exporter wrote. */
export interface LeanIxExport {
  host: string;
  workspace: string;
  exportedAt: string;
  factSheets: FactSheet[];
  relations: FactSheetRelation[];
  /** The fact sheet types the workspace has, with counts — its meta-model in miniature. */
  types: Array<{ type: string; count: number }>;
}
