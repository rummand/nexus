"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CornerDownRight, History, Layers, Plus } from "lucide-react";
import type { EntityDetail } from "@/lib/graph-types";
import type { MetaField } from "@/lib/metamodel";
import { completeness, sheetSections } from "@/lib/factsheet";
import { describeActor, describeChange, whenWords } from "@/lib/history/events";
import { setEntityAttributeAction, setEntityParentAction, updateEntity } from "@/lib/actions";
import { LiveValue } from "./LiveValue";

/**
 * One object, one page (§5.77).
 *
 * The drawer was the right thing beside a canvas and the wrong thing everywhere else: an object
 * is not an annotation on a list, it is the thing itself, and it deserves an address somebody can
 * send in a mail. So every object has a page, it is laid out by the type's own sections, and
 * every value on it is editable where it sits — no edit mode, no save button, no dialog.
 *
 * What the page refuses to do is as important as what it does. It does not invent sections for
 * fields nobody has filed, it does not hide a required field because it is empty, and it does not
 * pretend the history starts here: the log below is the same one the rest of the product reads.
 */

export function FactSheet({
  slug,
  detail,
  fields,
  color,
  typeDeclared,
  framework,
}: {
  slug: string;
  detail: EntityDetail;
  fields: MetaField[];
  color: string;
  typeDeclared: boolean;
  framework: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const e = detail.entity;
  /*
   * One clock for the whole page, read at render. Calling Date.now() per line would make two
   * timestamps a second apart read as different ages, and the server and the client would
   * disagree about "just now" on hydration.
   */
  const [now] = useState(() => Date.now());

  const sections = useMemo(() => sheetSections(fields, e.attributes), [fields, e.attributes]);
  const filled = useMemo(() => completeness(sections), [sections]);
  const byKind = useMemo(() => {
    const map = new Map<string, EntityDetail["relations"]>();
    for (const r of detail.relations) map.set(r.kind, [...(map.get(r.kind) ?? []), r]);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [detail.relations]);

  /** Every edit goes the same way: write, then let the server re-render the page it changed. */
  const write = (run: () => Promise<unknown>) =>
    new Promise<void>((resolve) => {
      start(async () => {
        await run();
        router.refresh();
        resolve();
      });
    });

  const href = (id: string) => `/w/${slug}/fs/${id}`;

  return (
    <article className="factsheet" data-factsheet={e.id}>
      <header className="fs-head">
        <nav className="fs-crumbs" aria-label="Where it sits">
          <Link href={`/w/${slug}/repository`}>Fact sheets</Link>
          <span>/</span>
          <Link href={`/w/${slug}/type/${encodeURIComponent(e.kind)}`}>{e.kind || "Untyped"}</Link>
          {detail.ancestry.slice(0, -1).map((a) => (
            <span key={a.id} className="fs-crumb-up">
              <span>/</span>
              <Link href={href(a.id)} data-crumb={a.id}>{a.name}</Link>
            </span>
          ))}
        </nav>

        <div className="fs-title">
          <i style={{ background: color || "#94a3b8" }} aria-hidden="true" />
          <LiveValue
            value={e.name}
            label="Name"
            big
            onCommit={(next) => write(() => updateEntity(e.id, { name: next }))}
          />
        </div>

        <div className="fs-facts">
          <span className="fs-kind" data-fs-kind>
            {e.kind || "Untyped"}
            <em>{typeDeclared ? (framework ? `declared · ${framework}` : "declared") : "not declared"}</em>
          </span>
          <span>{detail.relations.length} relation{detail.relations.length === 1 ? "" : "s"}</span>
          <span>{detail.children.length} inside · {detail.beneath} beneath</span>
          <span>{detail.boards.length} board{detail.boards.length === 1 ? "" : "s"}</span>
          <span data-fs-complete>
            {filled.filled}/{filled.declared} declared fields filled
            {filled.missing > 0 && <b> · {filled.missing} required and empty</b>}
          </span>
          <span className="fs-changed">changed {whenWords(e.updatedAt, now)}</span>
        </div>
      </header>

      <div className="fs-body">
        <main className="fs-main">
          <section className="fs-section" data-fs-section="Description">
            <h2>Description</h2>
            <LiveValue
              value={e.description}
              label="Description"
              multiline
              placeholder="Nobody has said what this is. Write it here."
              onCommit={(next) => write(() => updateEntity(e.id, { description: next }))}
            />
          </section>

          {sections.map((section) => (
            <section className="fs-section" key={section.title} data-fs-section={section.title}>
              <h2>
                {section.title}
                {section.fromData && <em title="Keys the meta-model has never heard of">undeclared</em>}
              </h2>
              <dl className="fs-fields">
                {section.values.map((v) => (
                  <div key={v.key} className={v.missing ? "fs-field missing" : "fs-field"} data-fs-field={v.key}>
                    <dt>
                      {v.key}
                      {v.field?.required && <b title="Required by the meta-model">*</b>}
                      {v.field?.description && <small>{v.field.description}</small>}
                    </dt>
                    <dd>
                      <LiveValue
                        value={v.value}
                        field={v.field}
                        label={v.key}
                        placeholder={v.missing ? "required — nothing here yet" : "—"}
                        onCommit={(next) => write(() => setEntityAttributeAction(e.id, v.key, next))}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {byKind.length > 0 && (
            <section className="fs-section" data-fs-section="Relations">
              <h2>Connected to</h2>
              {byKind.map(([kind, list]) => (
                <div className="fs-rel-group" key={kind} data-fs-relation={kind}>
                  <h3>{kind} <small>{list.length}</small></h3>
                  <ul>
                    {list.map((r) => (
                      <li key={r.id}>
                        {r.direction === "in" && <ArrowRight size={11} className="fs-in" aria-label="incoming" />}
                        <Link href={href(r.other.id)}>{r.other.name}</Link>
                        <em>{r.other.kind}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </main>

        <aside className="fs-side">
          <section className="fs-card" data-fs-section="Where it sits">
            <h2><Layers size={13} /> Where it sits</h2>
            {detail.ancestry.length > 1 ? (
              <p className="fs-path">
                {detail.ancestry.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <span className="sep">›</span>}
                    {a.id === e.id ? <b>{a.name}</b> : <Link href={href(a.id)}>{a.name}</Link>}
                  </span>
                ))}
              </p>
            ) : (
              <p className="fs-none">At the top level — nothing contains it.</p>
            )}

            <label className="fs-move">
              <span>Move inside…</span>
              <select
                defaultValue=""
                onChange={(ev) => {
                  const to = ev.target.value;
                  ev.target.value = "";
                  void write(() => setEntityParentAction(e.id, to || null));
                }}
                data-fs-move
              >
                <option value="">Move inside…</option>
                <option value="">↑ To the top level</option>
                {detail.parentOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.path}</option>
                ))}
              </select>
            </label>

            {detail.children.length > 0 && (
              <ul className="fs-children">
                {detail.children.map((c) => (
                  <li key={c.id}>
                    <CornerDownRight size={11} />
                    <Link href={href(c.id)}>{c.name}</Link>
                    <em>{c.kind}{c.beneath ? ` · ${c.beneath} beneath` : ""}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.boards.length > 0 && (
            <section className="fs-card" data-fs-section="Boards">
              <h2>On boards</h2>
              <ul className="fs-boards">
                {detail.boards.map((b) => (
                  <li key={b.id}>
                    <Link href={`/b/${b.id}`}>{b.name} <ArrowUpRight size={11} /></Link>
                    <em>{b.spaceName}</em>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {detail.duplicates.length > 0 && (
            <section className="fs-card warn" data-fs-section="Duplicates">
              <h2>Others with this name</h2>
              <ul className="fs-boards">
                {detail.duplicates.map((d) => (
                  <li key={d.id}><Link href={href(d.id)}>{d.name}</Link><em>{d.kind}</em></li>
                ))}
              </ul>
            </section>
          )}

          <section className="fs-card" data-fs-section="History">
            <h2><History size={13} /> What happened to it</h2>
            {detail.history.length === 0 ? (
              <p className="fs-none">Nothing since the graph started remembering.</p>
            ) : (
              <ol className="fs-history">
                {detail.history.slice(0, 25).map((ev) => (
                  <li key={ev.id} data-fs-event={ev.kind}>
                    <b>{describeActor(ev.actor)}</b> {describeChange(ev)}
                    <time>{whenWords(ev.at, now)}{ev.context ? ` · ${ev.context}` : ""}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="fs-card" data-fs-section="Add">
            <h2><Plus size={13} /> Add a field</h2>
            <p className="fs-none">
              Anything this type should carry belongs in the{" "}
              <Link href={`/w/${slug}/meta`}>meta-model</Link> — declare it there and it appears on
              every {e.kind || "object"}, in the section you put it in.
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
