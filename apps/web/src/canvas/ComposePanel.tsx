"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Sparkles, X } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";
import type { CanvasDocument } from "./document";
import type { ComposeStep } from "@/lib/compose/run";
import type { Vocabulary } from "@/lib/compose/script";

/**
 * Compose — write the board.
 *
 * No dragging, no placing: you write what the board should contain and it is built. Each line is
 * compiled against the workspace's real vocabulary and shown back as the query it became, so the
 * English is a convenience and the query is the truth. A rebuild starts from an empty board, which
 * is what keeps the text and the picture the same thing: the script *is* the board.
 */

const STARTER = `title Metering landscape
add all applications
connect them
lay out as flow
group by lifecycle`;

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
  const [script, setScript] = useState(STARTER);
  const [mode, setMode] = useState<"rebuild" | "extend">("rebuild");
  const [steps, setSteps] = useState<ComposeStep[]>([]);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
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
      const data = (await res.json()) as { document: CanvasDocument; steps: ComposeStep[]; vocabulary: Vocabulary };
      const s = store.getState();
      s.clearSelection();
      s.replaceElements(data.document.elements, { history: true });
      s.zoomToFit();
      setSteps(data.steps);
      setVocabulary(data.vocabulary);
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
          <span>Write the board. Nothing is dragged.</span>
        </div>
        <button type="button" onClick={() => store.getState().togglePanel("compose", false)} aria-label="Close compose"><X size={16} /></button>
      </header>

      <textarea
        ref={areaRef}
        className="compose-script"
        value={script}
        spellCheck={false}
        onChange={(e) => setScript(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void build(); }
          e.stopPropagation(); // the canvas owns single-key shortcuts; this is a text field
        }}
        aria-label="Board script"
        placeholder={STARTER}
      />

      <div className="compose-actions">
        <label className="compose-mode">
          <input type="checkbox" checked={mode === "rebuild"} onChange={(e) => setMode(e.target.checked ? "rebuild" : "extend")} />
          {mode === "rebuild" ? `Rebuild — replaces ${onBoard} object${onBoard === 1 ? "" : "s"}` : "Add to what is here"}
        </label>
        <button type="button" className="primary-home-button" disabled={busy || !script.trim()} onClick={() => void build()}>
          <Play size={14} /> {busy ? "Building…" : "Build"}
        </button>
      </div>

      {error && <p className="compose-error">{error}</p>}

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
        <p className="compose-summary">{built} of {steps.length} line{steps.length === 1 ? "" : "s"} did something.</p>
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
