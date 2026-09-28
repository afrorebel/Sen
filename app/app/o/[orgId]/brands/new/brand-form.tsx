"use client";

import { useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { COUNTRIES, suggestPrompts } from "@/lib/locations";

export function BrandForm({
  action,
  promptLimit,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  promptLimit: number;
}) {
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [promptText, setPromptText] = useState("");
  const count = promptText.split("\n").filter((l) => l.trim().length >= 5).length;

  function suggest() {
    const names = competitors.split("\n").map((l) => l.split(/[|,]/)[0].trim()).filter(Boolean);
    const ideas = suggestPrompts({ category, city, competitors: names }).map((p) => p.text);
    const existing = new Set(promptText.split("\n").map((l) => l.trim()));
    setPromptText([...existing, ...ideas.filter((i) => !existing.has(i))].filter(Boolean).join("\n"));
  }

  return (
    <ActionForm action={action} className="card stack">
      <div className="field-row">
        <label>
          Brand name
          <input name="name" required placeholder="Acme Restoration" />
        </label>
        <label>
          Website
          <input name="domain" required placeholder="acmerestoration.com" />
        </label>
      </div>
      <label>
        What do you sell?
        <input
          name="category"
          placeholder="water damage restoration"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <span className="hint">In the words a customer would use. We use it to suggest prompts.</span>
      </label>
      <div className="field-row">
        <label>
          Country
          <select name="country" defaultValue="US">
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          City (optional)
          <input name="city" placeholder="Dallas" value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
      </div>
      <label>
        Other names for your brand (optional)
        <input name="aliases" placeholder="Acme, Acme Restoration LLC" />
      </label>
      <label>
        Competitors, one per line (optional)
        <textarea
          name="competitors"
          rows={3}
          placeholder={"ServPro | servpro.com\nPaul Davis | pauldavis.com"}
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
        />
        <span className="hint">Name | domain. We&apos;ll also discover competitors the AI recommends.</span>
      </label>
      <label>
        Buyer prompts, one per line
        <textarea
          name="prompts"
          rows={8}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={"Best water damage restoration company in Dallas\nHow much does water damage restoration cost?"}
        />
        <span className="hint">
          {count} of {promptLimit} prompts ·{" "}
          <button type="button" className="linklike" onClick={suggest} disabled={!category.trim()}>
            Suggest prompts from my category
          </button>
        </span>
      </label>
      <SubmitButton pendingText="Creating brand and starting first check…">Create brand &amp; run first check</SubmitButton>
    </ActionForm>
  );
}
