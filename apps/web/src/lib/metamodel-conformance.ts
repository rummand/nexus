import type { MetaModel, MetaNodeType, MetaRelationType } from "./metamodel";

/**
 * Does the estate obey the model this organisation declared? (§5.56)
 *
 * §5.14 built the declaration — types, fields with data types, required flags, enum options,
 * relation rules — and then only ever counted rule violations. Everything else the modeller wrote
 * down was decoration: a field could be marked required and be missing everywhere, an enum could
 * list three options and the data hold nine, a date field could contain "Q3". A model nothing is
 * checked against is a diagram of good intentions.
 *
 * This is deliberately **not** `health.ts`. That asks whether an estate is in good shape by general
 * EA standards — provenance, duplicates, orphans — with checks nobody chose. This asks the narrower
 * and more useful question: does the data obey *the rules these people wrote for themselves*. An
 * estate can be in poor health and perfectly conformant, or immaculate and conform to nothing.
 *
 * Nothing here rejects a write. The product's whole premise is that a model grows from the work
 * (§5.14), and a canvas that refuses a card because a field is missing would stop the drawing that
 * produces the model in the first place. So conformance reports, names the offenders, and leaves
 * the decision where it belongs.
 */

export type BreachKind =
  | "kind-undeclared"
  | "field-missing"
  | "field-type"
  | "field-option"
  | "relation-undeclared"
  | "relation-rule";

export interface Breach {
  kind: BreachKind;
  /** What is wrong with this one object, in a sentence somebody can act on. */
  detail: string;
  subjectId: string;
  subjectName: string;
  subject: "entity" | "relation";
  /** The node or relation type the subject belongs to. */
  typeName: string;
  field?: string;
}

export interface TypeConformance {
  name: string;
  kind: "node" | "relation";
  instances: number;
  /** Instances with at least one breach. */
  offenders: number;
  breaches: number;
  declared: boolean;
}

export interface Conformance {
  breaches: Breach[];
  byType: TypeConformance[];
  /** Share of instances of *declared* types that break nothing, 0–100. */
  score: number;
  /** How many instances were checked — those whose type was declared. */
  checked: number;
  /** Share of all instances whose type is declared at all, 0–100. */
  typed: number;
  counts: Record<BreachKind, number>;
}

export interface EntityLike {
  id: string;
  kind: string;
  name: string;
  attributes: Record<string, string>;
}

export interface RelationLike {
  id: string;
  kind: string;
  fromKind: string;
  toKind: string;
  fromName: string;
  toName: string;
}

/**
 * Does a written-down value match the data type it was declared as?
 *
 * Everything on an entity is a string — the attributes are a JSON object of them — so this is about
 * what a person typed, not about a runtime type. Empty is not a type failure: an absent value is
 * `field-missing`'s business when the field is required, and nobody's otherwise.
 */
export function valueFits(dataType: string, value: string, options: string[] = []): boolean {
  const v = value.trim();
  if (!v) return true;
  switch (dataType) {
    case "number":
      return Number.isFinite(Number(v.replace(/[\s,]/g, "")));
    case "boolean":
      return ["true", "false", "yes", "no", "y", "n", "1", "0"].includes(v.toLowerCase());
    case "date":
      // A year, a month or a full date. Anything a person would defend as a date in a spreadsheet.
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v) || !Number.isNaN(Date.parse(v));
    case "url":
      return /^(https?:\/\/|www\.)\S+\.\S+/i.test(v);
    case "enum":
      // No options declared means the enum has not been given a vocabulary yet, so nothing to fail.
      return options.length === 0 || options.some((o) => o.trim().toLowerCase() === v.toLowerCase());
    default:
      return true;
  }
}

const label = (name: string) => name.trim() || "(unnamed)";
/**
 * "an Interface", "a System", "an IT Component", "a User".
 *
 * Type names are somebody else's words and they end up mid-sentence, so the article has to follow
 * how the name is *said*, not how it is spelt. Two rules cover everything an estate throws at it:
 * a leading acronym is read letter by letter (IT, API, SLA all start with a vowel sound), and a
 * leading "u" is almost always "yoo" in the words people use for types — User, Unit, Utility.
 */
const SOUNDED = new Set("AEFHILMNORSX".split(""));
export function article(word: string): "a" | "an" {
  const w = word.trim();
  if (!w) return "a";
  const acronym = /^[A-Z]{2,}\b/.exec(w);
  if (acronym) return SOUNDED.has(acronym[0]![0]!) ? "an" : "a";
  if (/^u/i.test(w)) return "a";
  return /^[aeio]/i.test(w) ? "an" : "a";
}

/** Every way this estate departs from what was declared, named object by named object. */
export function conformance(model: MetaModel, entities: EntityLike[], relations: RelationLike[]): Conformance {
  const nodeByName = new Map<string, MetaNodeType>();
  for (const t of model.nodeTypes) nodeByName.set(t.name.trim().toLowerCase(), t);
  const relByName = new Map<string, MetaRelationType>();
  for (const t of model.relationTypes) relByName.set(t.name.trim().toLowerCase(), t);

  const breaches: Breach[] = [];
  const offendersByType = new Map<string, Set<string>>();
  const instancesByType = new Map<string, number>();
  const kindOf = new Map<string, "node" | "relation">();
  const declaredOf = new Map<string, boolean>();

  const note = (typeName: string, kind: "node" | "relation", declared: boolean) => {
    instancesByType.set(typeName, (instancesByType.get(typeName) ?? 0) + 1);
    kindOf.set(typeName, kind);
    declaredOf.set(typeName, declared);
  };
  const blame = (typeName: string, subjectId: string, breach: Breach) => {
    breaches.push(breach);
    let set = offendersByType.get(typeName);
    if (!set) offendersByType.set(typeName, (set = new Set()));
    set.add(subjectId);
  };

  let checked = 0;
  let typedInstances = 0;

  for (const e of entities) {
    const kindName = e.kind.trim() || "(untyped)";
    const declaredType = nodeByName.get(kindName.toLowerCase());
    // A type that only ever grew from the data was never declared, whatever the merge calls it.
    const isDeclared = Boolean(declaredType && declaredType.id);
    note(kindName, "node", isDeclared);
    if (!isDeclared) {
      blame(kindName, e.id, {
        kind: "kind-undeclared",
        detail: kindName === "(untyped)"
          ? `“${label(e.name)}” has no kind at all, so nothing in the model applies to it.`
          : `“${label(e.name)}” is ${article(kindName)} ${kindName}, a kind nobody declared.`,
        subjectId: e.id,
        subjectName: label(e.name),
        subject: "entity",
        typeName: kindName,
      });
      continue;
    }
    typedInstances++;
    checked++;

    for (const field of declaredType!.fields) {
      const raw = e.attributes[field.key];
      const value = (raw ?? "").trim();
      if (!value) {
        if (field.required) {
          blame(kindName, e.id, {
            kind: "field-missing",
            detail: `“${label(e.name)}” has no ${field.key}, and ${kindName} requires one.`,
            subjectId: e.id, subjectName: label(e.name), subject: "entity", typeName: kindName, field: field.key,
          });
        }
        continue;
      }
      if (field.dataType === "enum" && field.options.length > 0 && !valueFits("enum", value, field.options)) {
        blame(kindName, e.id, {
          kind: "field-option",
          detail: `“${label(e.name)}” has ${field.key} “${value}”, which is not one of ${field.options.join(", ")}.`,
          subjectId: e.id, subjectName: label(e.name), subject: "entity", typeName: kindName, field: field.key,
        });
      } else if (field.dataType !== "enum" && !valueFits(field.dataType, value)) {
        blame(kindName, e.id, {
          kind: "field-type",
          detail: `“${label(e.name)}” has ${field.key} “${value}”, which is not a ${field.dataType}.`,
          subjectId: e.id, subjectName: label(e.name), subject: "entity", typeName: kindName, field: field.key,
        });
      }
    }
  }

  for (const r of relations) {
    const kindName = r.kind.trim() || "(unlabelled)";
    const declaredType = relByName.get(kindName.toLowerCase());
    const isDeclared = Boolean(declaredType && declaredType.id);
    note(kindName, "relation", isDeclared);
    const pair = `${label(r.fromName)} → ${label(r.toName)}`;
    if (!isDeclared) {
      blame(kindName, r.id, {
        kind: "relation-undeclared",
        detail: `${pair} is joined by “${kindName}”, a relation type nobody declared.`,
        subjectId: r.id, subjectName: pair, subject: "relation", typeName: kindName,
      });
      continue;
    }
    typedInstances++;
    checked++;
    const rules = declaredType!.rules;
    // No rules at all means the type is deliberately unconstrained, not that everything breaks it.
    if (rules.length === 0) continue;
    const allowed = rules.some((rule) =>
      rule.fromType.trim().toLowerCase() === r.fromKind.trim().toLowerCase()
      && rule.toType.trim().toLowerCase() === r.toKind.trim().toLowerCase());
    if (!allowed) {
      blame(kindName, r.id, {
        kind: "relation-rule",
        detail: `${pair} is ${r.fromKind} → ${r.toKind}, which no rule for “${kindName}” allows.`,
        subjectId: r.id, subjectName: pair, subject: "relation", typeName: kindName,
      });
    }
  }

  const byType: TypeConformance[] = [...instancesByType.entries()]
    .map(([name, instances]) => ({
      name,
      kind: kindOf.get(name) ?? "node",
      instances,
      offenders: offendersByType.get(name)?.size ?? 0,
      breaches: breaches.filter((b) => b.typeName === name).length,
      declared: declaredOf.get(name) ?? false,
    }))
    .sort((a, b) => b.offenders - a.offenders || b.instances - a.instances || a.name.localeCompare(b.name));

  const offendersAmongChecked = new Set(
    breaches.filter((b) => b.kind !== "kind-undeclared" && b.kind !== "relation-undeclared").map((b) => b.subjectId),
  ).size;

  const counts = { "kind-undeclared": 0, "field-missing": 0, "field-type": 0, "field-option": 0, "relation-undeclared": 0, "relation-rule": 0 } as Record<BreachKind, number>;
  for (const b of breaches) counts[b.kind]++;

  const total = entities.length + relations.length;
  return {
    breaches,
    byType,
    // Out of what could be checked. An estate with nothing declared scores 100 on nothing, which is
    // why `typed` is reported beside it rather than folded into it.
    score: checked === 0 ? 100 : Math.round(((checked - offendersAmongChecked) / checked) * 100),
    checked,
    typed: total === 0 ? 100 : Math.round((typedInstances / total) * 100),
    counts,
  };
}

/** What the two numbers mean, in words rather than a colour nobody can read out loud. */
export function conformanceLabel(c: Conformance): string {
  if (c.checked === 0) return "Nothing is declared yet, so there is nothing to conform to.";
  if (c.typed < 50) return "Most of this estate is of types nobody has declared — the model describes a minority of it.";
  if (c.score >= 98) return "The estate obeys the model it was given.";
  if (c.score >= 85) return "Mostly conformant; the exceptions below are worth a decision each.";
  if (c.score >= 60) return "A meaningful part of the estate breaks the declared model — either the data is wrong or the model is.";
  return "The declared model and the data disagree more than they agree. One of them needs to change.";
}
