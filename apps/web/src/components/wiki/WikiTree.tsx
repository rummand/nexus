"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { WikiNode } from "@/lib/wiki/pages";

/** The tree down the side. Open by default two levels down, which is where most wikis stop. */
export function WikiTree({ nodes, slug, current }: { nodes: WikiNode[]; slug: string; current?: string }) {
  return <ul className="wiki-tree" data-wiki-tree>{nodes.map((n) => <Branch key={n.id} node={n} slug={slug} current={current} depth={0} />)}</ul>;
}

function Branch({ node, slug, current, depth }: { node: WikiNode; slug: string; current?: string; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const active = node.slug === current;
  return (
    <li className={active ? "active" : ""}>
      <div className="wiki-tree-row" style={{ paddingLeft: 4 + depth * 12 }}>
        {node.children.length > 0 ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <span className="wiki-tree-spacer" />}
        <Link href={`/w/${slug}/wiki/${node.slug}`} data-wiki-page={node.slug}>
          <i>{node.icon || <FileText size={13} />}</i>
          <span>{node.title}</span>
        </Link>
      </div>
      {open && node.children.length > 0 && (
        <ul>{node.children.map((c) => <Branch key={c.id} node={c} slug={slug} current={current} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}
