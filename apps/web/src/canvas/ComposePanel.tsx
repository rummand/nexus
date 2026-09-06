"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, MessageSquare, Play, Search, Sparkles, X } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";
import type { CanvasDocument } from "./document";
import type { ComposeResult, ComposeStep } from "@/lib/compose/run";

type ComposeResponse = Omit<ComposeResult, "document"> & { document: CanvasDocument };
import type { Vocabulary } from "@/lib/compose/script";

/**
 * Compose — ask for a board and get one.
 *
 * No dragging, no placing: you say what you want and it is built. A model plans the answer as a
 * board script; the script is validated against a closed instruction set and executed. Both halves
 * are shown — the answer in English, and the steps it actually ran — because a board you cannot
 * interrogate is a board you cannot trust. Where no model is configured, the rule compiler reads
 * the lines instead and the panel says so.
 */

const EXAMPLES = [
  "Show me the applications that depend on SCADA, and what they support",
  "Which applications have no owner? Group them by lifecycle",
  "Build the metering landscape around Maximo, two hops out",
  "Everything the architecture board discussed, laid out as a flow",
];

const VERBS: Array<[string, string]> = [
  ["add", "add all applications · add anything that depends on SCADA · add applications without an owner"],
  ["remove", "remove people · remove anything with no owner"],
  ["expand", "expand 1 hop · expand 2 hops via “depends on” · expand upstream"],
  ["connect", "connect them · connect via “sends data to”"],
  ["group by", "group by kind · group by lifecycle"],
  ["lay out", "lay out as flow · lay out in columns by lifecycle · lay out as circle"],
  ["colour by", "colour by criticality"],
  ["title / note", "title Metering landscape · note we decided to replace Maximo"],
  ["clear", "empty the board"],
];

export function ComposePanel({ rootRef }: { rootRef: React.RefObject<HTMLElement | null> }) {
  const store = useCanvasStore();
  const workspaceId = useCanvas((s) => s.workspaceId);
  /**
   * Seeded from the board: reopening a written board shows the words that produced it, not an
   * empty box. Kept in the store as you type, so the autosave carries it with the document.
   */
  const saved = useCanvas((s) => s.script);
  const [script, setScript] = useState(saved);
  const [mode, setMode] = useState<"rebuild" | "extend">("rebuild");
  const [steps, setSteps] = useState<ComposeStep[]>([]);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [reply, setReply] = useState("");
  const [engine, setEngine] = useState<"model" | "rules" | null>(null);
  const [status, setStatus] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [looked, setLooked] = useState<string[]>([]);
  const [grounded, setGrounded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const onBoard = useCanvas((s) => Object.keys(s.elements).length);

  useEffect(() => { areaRef.current?.focus(); }, []);
  void rootRef;

  const build = async () => {
    // Rebuilding throws away whatever is on the board. Version history can undo it, but being
    // told beforehand is better than discovering it afterwards — as the author found out.
    if (mode === "rebuild" && onBoard > 0 && steps.length === 0) {
      const ok = confirm(`Rebuild replaces the ${onBoard} object${onBoard === 1 ? "" : "s"} on this board with whatever the script produces. A checkpoint is kept in History. Continue?`);
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/graph/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, script, mode, document: store.getState().toDocument() }),
      });
      if (!res.ok) throw new Error(`the build failed (${res.status})`);
      const data = (await res.json()) as ComposeResponse;
      const s = store.getState();
      s.clearSelection();
      s.replaceElements(data.document.elements, { history: true });
      s.zoomToFit();
      setSteps(data.steps);
      setVocabulary(data.vocabulary);
      setReply(data.reply ?? "");
      setEngine(data.engine);
      setStatus(data.status ?? "");
      setRejected(data.rejected ?? []);
      setLooked(data.looked ?? []);
      setGrounded(data.grounded ?? []);
      // A planner writes a script of its own; show it, so what ran is what you can edit and re-run.
      if (data.document.script && data.document.script !== script) {
        setScript(data.document.script);
        store.getState().setScript(data.document.script);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "the build failed");
    } finally {
      setBusy(false);
    }
  };

  const built = steps.filter((s) => s.ok).length;

  return (
    <section className="compose-panel" data-compose onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <Sparkles size={15} />
        <div>
          <strong>Compose</strong>
          <span>Ask for a board. Nothing is dragged.</span>
        </div>
        <button type="button" onClick={() => store.getState().togglePanel("compose", false)} aria-label="Close compose"><X size={16} /></button>
      </header>

      <textarea
        ref={areaRef}
        className="compose-script"
        value={script}
        spellCheck={false}
        onChange={(e) => { setScript(e.target.value); store.getState().setScript(e.target.value); }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void build(); }
          e.stopPropagation(); // the canvas owns single-key shortcuts; this is a text field
        }}
        aria-label="What the board should show"
        placeholder={"Ask for a board in your own words — or write the script yourself:\n\n  add all applications\n  connect them\n  lay out as flow"}
      />

      {saved.trim() !== "" && script.trim() === saved.trim() && (
        <p className="compose-saved">This board was written. Edit the lines and build again, or leave it as it is.</p>
      )}

      {script.trim() === "" && (
        <ul className="compose-examples">
          {EXAMPLES.map((e) => (
            <li key={e}><button type="button" onClick={() => { setScript(e); store.getState().setScript(e); }}>{e}</button></li>
          ))}
        </ul>
      )}

      <div className="compose-actions">
        <label className="compose-mode">
          <input type="checkbox" checked={mode === "rebuild"} onChange={(e) => setMode(e.target.checked ? "rebuild" : "extend")} />
          {mode === "rebuild" ? `Rebuild — replaces ${onBoard} object${onBoard === 1 ? "" : "s"}` : "Add to what is here"}
        </label>
        <button type="button" className="primary-home-button" disabled={busy || !script.trim()} onClick={() => void build()}>
          <Play size={14} /> {busy ? "Thinking…" : "Build"}
        </button>
      </div>

      {error && <p className="compose-error">{error}</p>}
      {status && <p className="compose-status">{status}</p>}

      {looked.length > 0 && (
        <ul className="compose-looked" aria-label="What it checked before answering" data-looked>
          {looked.map((l, i) => <li key={i}><Search size={11} /> {l}</li>)}
        </ul>
      )}

      {/* What the knowledge base told it before it answered (§5.20). */}
      {grounded.length > 0 && (
        <ul className="compose-grounded" aria-label="Practice it was grounded in" data-grounded>
          {grounded.map((g, i) => <li key={i}><BookOpen size={11} /> {g}</li>)}
        </ul>
      )}

      {reply && (
        <p className="compose-reply" data-reply>
          <MessageSquare size={13} /> {reply}
        </p>
      )}

      {rejected.length > 0 && (
        <ul className="compose-rejected" aria-label="Not allowed through">
          {rejected.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {steps.length > 0 && (
        <ol className="compose-steps" aria-label="What each line did">
          {steps.map((step, i) => (
            <li key={i} className={step.ok ? "ok" : "failed"} data-step>
              <code>{step.raw}</code>
              <em>{step.echo}</em>
              <span>{step.message}</span>
            </li>
          ))}
        </ol>
      )}

      {steps.length > 0 && (
        <p className="compose-summary">
          {built} of {steps.length} step{steps.length === 1 ? "" : "s"} did something ·{" "}
          <em className={`compose-engine ${engine}`}>{engine === "model" ? "planned by the model" : "read by the rule compiler"}</em>
        </p>
      )}

      <details className="compose-help">
        <summary>What you can write</summary>
        <dl>
          {VERBS.map(([verb, examples]) => (
            <div key={verb}><dt>{verb}</dt><dd>{examples}</dd></div>
          ))}
        </dl>
        {vocabulary && (
          <p className="compose-vocab">
            <b>This workspace knows:</b> {vocabulary.kinds.slice(0, 8).join(", ")}
            {vocabulary.relationKinds.length > 0 && <> · relations {vocabulary.relationKinds.slice(0, 6).join(", ")}</>}
            {vocabulary.attributeKeys.length > 0 && <> · attributes {vocabulary.attributeKeys.slice(0, 6).join(", ")}</>}
          </p>
        )}
      </details>
    </section>
  );
}
