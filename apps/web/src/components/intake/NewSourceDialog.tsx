"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, X } from "lucide-react";
import { availableProviders } from "@/lib/catalog/providers";
import { createSource } from "@/lib/intake/actions";
import { SAMPLE_TRANSCRIPT } from "./sample";

/** Add a source: paste it, drop a file on it, or take the sample meeting. */
export function NewSourceDialog({ workspaceId, connectorId, onClose, onCreated }: {
  workspaceId: string;
  connectorId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [connector, setConnector] = useState(connectorId);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const result = await createSource({ workspaceId, name, text, connector });
      if ("error" in result && result.error) { setError(result.error); return; }
      if ("id" in result && result.id) onCreated(result.id);
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: 640 }} data-new-source>
        <header>
          <h2>New source</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="intake-form">
          <label>
            <span>Through</span>
            <select value={connector} onChange={(e) => setConnector(e.target.value)}>
              {availableProviders().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Architecture board, 14 March" aria-label="Source name" />
          </label>
          <label className="wide">
            <span>Content</span>
            <textarea
              rows={11}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a transcript, minutes or notes…"
              aria-label="Source text"
            />
          </label>
          <div className="intake-form-actions">
            <button type="button" className="ghost-button" onClick={() => fileRef.current?.click()}><FileUp size={14} /> Choose a file</button>
            <button type="button" className="ghost-button" onClick={() => { setText(SAMPLE_TRANSCRIPT); if (!name.trim()) setName("Metering architecture sync"); }}>
              Use the sample meeting
            </button>
            <span className="muted">{text.length.toLocaleString("en")} characters</span>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.vtt,.md,.csv,.json,text/plain"
              hidden
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {error && <p className="intake-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-home-button" disabled={pending || !text.trim()} onClick={submit}>
            {pending ? "Adding…" : "Add source"}
          </button>
        </div>
      </div>
    </div>
  );
}
