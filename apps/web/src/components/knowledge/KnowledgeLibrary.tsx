import Link from "next/link";
import { BookOpen, ExternalLink, GraduationCap, Library, Quote, Scale, Search, ShieldAlert, Sparkles } from "lucide-react";
import type { KnowledgeOverview, KnowledgeResult, Lesson, LessonScope } from "@/lib/knowledge";

/**
 * The knowledge base, as a library rather than a settings page.
 *
 * Everything here is server-rendered and driven by the URL: the query, the tab. That is not
 * austerity — a passage somebody found is worth sending to a colleague, and a link is how you
 * send it. It also keeps the corpus (megabytes of text) on the server where it belongs.
 */

const SCOPES: Array<{ id: LessonScope; label: string; where: string }> = [
  { id: "compose", label: "Compose", where: "the planner that writes boards from a sentence" },
  { id: "intake", label: "Intake", where: "the extractor that reads meetings and documents" },
  { id: "modelling", label: "Modelling", where: "proposals about entities, kinds and relations" },
  { id: "metamodel", label: "Meta-model", where: "the type-level view and its rules" },
  { id: "health", label: "Estate health", where: "what each measure is arguing for" },
];

const EXAMPLES = [
  "what is a business capability",
  "how do you rationalise an application portfolio",
  "why record architecture decisions",
  "bounded context",
  "master data management",
  "zero trust",
];

export function KnowledgeLibrary({ slug, overview, result, tab }: {
  slug: string;
  overview: KnowledgeOverview;
  result: KnowledgeResult | null;
  tab: "search" | "sources" | "lessons";
}) {
  const base = `/w/${slug}/knowledge`;
  return (
    <section className="studio-home-main knowledge" aria-label="Enterprise architecture knowledge base">
      <header className="studio-home-topbar">
        <div>
          <span>Knowledge</span>
          <h1>EA knowledge base</h1>
          <p className="knowledge-lede">
            A standalone module: {overview.documents} openly-licensed sources, {overview.passages.toLocaleString()} passages,
            searched without a model and quoted with a citation every time. It is what the agents read — and{" "}
            <Link href={`${base}?tab=lessons`}>what they were taught from it</Link>.
          </p>
        </div>
        <div className="studio-home-actions knowledge-stats">
          <span className="knowledge-stat"><b>{overview.documents}</b> sources</span>
          <span className="knowledge-stat"><b>{overview.passages.toLocaleString()}</b> passages</span>
          <span className="knowledge-stat"><b>{overview.lessons.length}</b> lessons</span>
        </div>
      </header>

      <nav className="knowledge-tabs" aria-label="Knowledge base sections">
        <Link href={base} className={tab === "search" ? "active" : ""}><Search size={14} /> Search</Link>
        <Link href={`${base}?tab=lessons`} className={tab === "lessons" ? "active" : ""}><GraduationCap size={14} /> Doctrine <em>{overview.lessons.length}</em></Link>
        <Link href={`${base}?tab=sources`} className={tab === "sources" ? "active" : ""}><Library size={14} /> Sources <em>{overview.documents}</em></Link>
      </nav>

      {tab === "search" && <SearchTab base={base} result={result} overview={overview} />}
      {tab === "lessons" && <LessonsTab overview={overview} />}
      {tab === "sources" && <SourcesTab overview={overview} />}
    </section>
  );
}

function SearchTab({ base, result, overview }: { base: string; result: KnowledgeResult | null; overview: KnowledgeOverview }) {
  return (
    <>
      <form className="knowledge-search" action={base} method="get">
        <label className="studio-home-search">
          <Search size={16} />
          <input name="q" defaultValue={result?.query ?? ""} placeholder="Ask the corpus — “capability versus process”, “what is a bounded context”" aria-label="Search the knowledge base" autoFocus />
        </label>
        <button type="submit" className="primary-home-button">Search</button>
      </form>

      {!result && (
        <div className="knowledge-empty">
          <p>
            Retrieval here is lexical — BM25 over the corpus — so it works with no model API key at all.
            It answers with passages, never with prose of its own: what you read is what a source said.
          </p>
          <div className="knowledge-examples">
            {EXAMPLES.map((q) => (
              <Link key={q} href={`${base}?q=${encodeURIComponent(q)}`}>{q}</Link>
            ))}
          </div>
        </div>
      )}

      {result?.empty && (
        <div className="knowledge-empty warn">
          <p><ShieldAlert size={16} /> No corpus on disk. Run <code>pnpm --filter @nexus/ea-knowledge ingest</code> to build it.</p>
        </div>
      )}

      {result && !result.empty && (
        <div className="knowledge-results">
          <p className="knowledge-result-count">
            {result.passages.length
              ? `${result.passages.length} passage${result.passages.length === 1 ? "" : "s"} in ${result.tookMs} ms`
              : "Nothing matched."}
            {result.unknownTerms.length > 0 && (
              <em> The corpus has never seen: {result.unknownTerms.join(", ")}.</em>
            )}
          </p>
          {result.passages.map((p, i) => (
            <article key={p.id} className="knowledge-passage">
              <div className="knowledge-passage-head">
                <b>[{i + 1}] {p.label}</b>
                <span className="knowledge-license"><Scale size={11} /> {p.license}</span>
              </div>
              <p>{p.text}</p>
              <footer>
                <a href={p.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> {p.title}</a>
                <span>matched {p.matched.slice(0, 6).join(", ")}</span>
              </footer>
            </article>
          ))}
          {result.passages.length === 0 && (
            <div className="knowledge-empty">
              <p>
                Try fewer words, or a term of art. The corpus is {overview.documents} curated sources, not the web:
                it knows enterprise architecture and says nothing about anything else.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LessonsTab({ overview }: { overview: KnowledgeOverview }) {
  const byScope = new Map<LessonScope, Lesson[]>();
  for (const lesson of overview.lessons) {
    for (const scope of lesson.applies) {
      const list = byScope.get(scope) ?? [];
      list.push(lesson);
      byScope.set(scope, list);
    }
  }
  return (
    <div className="knowledge-lessons">
      <p className="knowledge-lede">
        Retrieval alone does not make an agent better at architecture; three paragraphs of encyclopedia in a prompt
        mostly add tokens. What changes behaviour is a short rule, applied at the moment a decision is being made —
        and every rule below quotes a passage that is really in the corpus. A test fails if it is not.
      </p>
      {SCOPES.map((scope) => {
        const lessons = byScope.get(scope.id) ?? [];
        if (!lessons.length) return null;
        return (
          <section key={scope.id} className="knowledge-scope">
            <h2><Sparkles size={15} /> {scope.label} <small>{scope.where}</small></h2>
            <ul>
              {lessons.map((lesson) => (
                <li key={`${scope.id}:${lesson.id}`} className="knowledge-lesson">
                  <strong>{lesson.statement}</strong>
                  <p>{lesson.detail}</p>
                  <blockquote>
                    <Quote size={12} /> {lesson.citation.quote}
                    <cite>{overview.sources.find((s) => s.id === lesson.citation.sourceId)?.title ?? lesson.citation.sourceId}</cite>
                  </blockquote>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {overview.lessons.length === 0 && (
        <div className="knowledge-empty"><p>No doctrine yet — the corpus has not been ingested.</p></div>
      )}
    </div>
  );
}

function SourcesTab({ overview }: { overview: KnowledgeOverview }) {
  return (
    <div className="knowledge-sources">
      <section className="knowledge-license-summary">
        <h2><Scale size={15} /> Licences</h2>
        <p>
          The corpus is committed to this repository and served from a product, which is redistribution. So the test
          is not “can I read it” but “may I ship it”. Everything here permits that, with attribution.
        </p>
        <ul>
          {overview.licenses.map((l) => (
            <li key={l.id}><b>{l.count}</b> {l.name}</li>
          ))}
        </ul>
        {overview.builtAt && <small>Corpus built {overview.builtAt} · {overview.characters.toLocaleString()} characters</small>}
      </section>

      <section className="knowledge-source-list">
        <h2><BookOpen size={15} /> In the corpus <small>{overview.documents} of {overview.registered} registered</small></h2>
        <ul>
          {overview.sources.map((s) => (
            <li key={s.id}>
              <div>
                <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title} <ExternalLink size={11} /></a>
                <span>{s.why}</span>
              </div>
              <div className="knowledge-source-meta">
                {s.topics.slice(0, 3).map((t) => <em key={t}>{t}</em>)}
                <span>{Math.round(s.characters / 1000)}k</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="knowledge-references">
        <h2><ShieldAlert size={15} /> Read, but not shipped</h2>
        <p>
          The canon of enterprise architecture is mostly not open. These belong on any reading list and none of them
          are ours to redistribute, so they are cited and linked — never ingested.
        </p>
        <ul>
          {overview.references.map((r) => (
            <li key={r.title}>
              <a href={r.url} target="_blank" rel="noreferrer noopener">{r.title} <ExternalLink size={11} /></a>
              <span>{r.author} — {r.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      {overview.unreachable.length > 0 && (
        <section className="knowledge-references">
          <h2><ShieldAlert size={15} /> Could not be fetched</h2>
          <ul>
            {overview.unreachable.map((u) => (
              <li key={u.id}><span>{u.title} — {u.error}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
