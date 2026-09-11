"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCampaign } from "@/lib/campaign/actions";

/**
 * Starting a campaign from something you already know how to say (§5.85).
 *
 * Four templates rather than an empty form, because nobody should have to design a campaign
 * from nothing — and because the four below are the ones the Energinet import made necessary.
 * Each is a scope in the objects list's own filter language, so "what is in it" is a question
 * somebody can answer by going and looking.
 */

const TEMPLATES: Array<{ id: string; name: string; description: string; scope: Record<string, unknown>; checks: string[] }> = [
  {
    id: "undeclared",
    name: "Describe what the import brought",
    description: "Every object whose type the meta-model has never heard of. Half the fix is usually to the meta-model rather than to the data.",
    scope: { declared: "no" },
    checks: ["types-declared"],
  },
  {
    id: "orphans",
    name: "Connect what is connected to nothing",
    description: "Objects with no relations and no place in the hierarchy — usually the sign of something imported and never modelled.",
    scope: { links: "orphan" },
    checks: ["no-orphans"],
  },
  {
    id: "required",
    name: "Fill the fields the model asks for",
    description: "Everything whose type declares a required field that nobody has filled.",
    scope: { declared: "yes" },
    checks: ["required-fields", "field-values"],
  },
  {
    id: "top",
    name: "Place what never got placed",
    description: "Objects sitting at the top level that probably belong inside something.",
    scope: { place: "top" },
    checks: ["no-orphans"],
  },
];

export function NewCampaign({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const make = (t: (typeof TEMPLATES)[number]) => {
    setError("");
    start(async () => {
      const r = await createCampaign({ workspaceId, name: t.name, description: t.description, scope: t.scope, checks: t.checks });
      if ("error" in r) { setError(r.error); return; }
      router.push(`/w/${slug}/campaigns/${r.id}`);
    });
  };

  return (
    <section className="campaign-new">
      <button type="button" className="ghost-button" onClick={() => setOpen(!open)} data-campaign-new>
        <Plus size={15} /> Start a campaign
      </button>
      {open && (
        <ul className="campaign-templates">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <button type="button" disabled={pending} onClick={() => make(t)} data-campaign-template={t.id}>
                <b>{t.name}</b>
                <span>{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="campaign-error">{error}</p>}
    </section>
  );
}
