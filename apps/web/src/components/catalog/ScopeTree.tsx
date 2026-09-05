"use client";

import { ChevronDown, ChevronRight, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ScopeNode, Sensitivity } from "@/lib/catalog/types";

/**
 * The grant conversation, drawn.
 *
 * Every node says what it is in the vendor's own words, what it would put in the Nexus graph,
 * what that would let the organisation ask, and how sensitive it is. Nobody should be asked to
 * tick a box whose consequence is not written next to it.
 */

const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  open: "open",
  internal: "internal",
  confidential: "confidential",
  personal: "personal data",
};

export function ScopeTree({ nodes, picked, wanted, onToggle, depth = 0 }: {
  nodes: ScopeNode[];
  picked: Set<string>;
  /** Scopes the agent asked for, highlighted so the ask is visible next to the choice. */
  wanted: Set<string>;
  onToggle: (node: ScopeNode, on: boolean) => void;
  depth?: number;
}) {
  return (
    <ul className={`scope-tree depth-${depth}`}>
      {nodes.map((node) => (
        <ScopeRow key={node.path} node={node} picked={picked} wanted={wanted} onToggle={onToggle} depth={depth} />
      ))}
    </ul>
  );
}

function ScopeRow({ node, picked, wanted, onToggle, depth }: {
  node: ScopeNode;
  picked: Set<string>;
  wanted: Set<string>;
  onToggle: (node: ScopeNode, on: boolean) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const children = node.children ?? [];
  const checked = picked.has(node.path);
  const partial = !checked && children.some((c) => picked.has(c.path) || (c.children ?? []).some((g) => picked.has(g.path)));

  return (
    <li className={`scope-node ${checked ? "granted" : ""} ${wanted.has(node.path) ? "wanted" : ""}`} data-scope={node.path}>
      <div className="scope-head">
        {children.length > 0 ? (
          <button type="button" className="scope-caret" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse" : "Expand"}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="scope-caret" />}
        <label>
          <input
            type="checkbox"
            checked={checked}
            ref={(el) => { if (el) el.indeterminate = partial; }}
            onChange={(e) => onToggle(node, e.target.checked)}
            aria-label={`Allow reading ${node.name}`}
          />
          <span className="scope-name">{node.name}</span>
          {node.technical && <code>{node.technical}</code>}
        </label>
        {wanted.has(node.path) && <em className="scope-wanted"><Sparkles size={11} /> asked for</em>}
        <span className={`scope-sensitivity ${node.sensitivity}`}>
          {node.sensitivity === "personal" ? <ShieldAlert size={11} /> : <Lock size={11} />} {SENSITIVITY_LABEL[node.sensitivity]}
        </span>
        {node.volume && <span className="scope-volume">{node.volume}</span>}
      </div>

      <p className="scope-description">{node.description}</p>
      <p className="scope-yields">
        <span>Into the graph:</span> {node.yields.join(", ")}
      </p>
      {node.enables && <p className="scope-enables">→ {node.enables}</p>}

      {open && children.length > 0 && (
        <ScopeTree nodes={children} picked={picked} wanted={wanted} onToggle={onToggle} depth={depth + 1} />
      )}
    </li>
  );
}
