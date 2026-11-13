"use client";

import React from "react";
import { AlertTriangle, ListChecks, Pencil, Quote, Sparkles } from "lucide-react";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { formatUsd } from "@/lib/cost";
import { Job, RequirementItem } from "@/types";
import { FIELD_LABELS, TypeBadge, TYPES, inputsChanged } from "./RequirementLists";

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

function ViewRow({ item }: { item: RequirementItem }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-[#2A3F5E] bg-[#132F4C]/50 px-2 py-1.5" data-testid="req-view-row">
      <TypeBadge type={item.type} />
      <span className="min-w-0 flex-1 text-sm leading-6 text-[#E0E0E0]">
        {item.text}
        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#78909C]">
          {TYPE_LABEL[item.type] || "Other"}
          {item.origin === "user" ? " · added by HR" : item.edited ? " · edited" : ""}
        </span>
      </span>
      <InfoPopover ariaLabel="Where this comes from" testId="req-view-source" className="mt-0.5"
        panelClassName="border-[#00C853]/40"
        label={<Quote size={13} className={item.source ? "text-[#69F0AE]" : "text-[#546E7A]"} />}>
        {item.source ? (
          <span className="text-xs text-[#CFD8DC]">
            <span className="block text-[10px] uppercase tracking-wide text-[#78909C]">
              From {FIELD_LABELS[item.source_field || ""] || "the job"}
            </span>
            “{item.source}”
          </span>
        ) : (
          <span className="text-xs text-[#B0BEC5]">
            {item.origin === "user" ? "Added by HR – not taken from the job text." : "No matching sentence was found in the job text."}
          </span>
        )}
      </InfoPopover>
    </li>
  );
}

/** The job's Must-Have / Nice-to-Have lists, read-only (job page). Editing happens in Edit Job. */
export function RequirementListsView({ job, onEdit }: { job: Job; onEdit: () => void }) {
  const must = job.must_have_requirements || [];
  const nice = job.nice_to_have_requirements || [];
  const generation = job.requirements_generation;
  const changed = inputsChanged({
    title: job.title || "", about_role: job.about_role || "", requirements: job.requirements || "",
    required_experience: job.required_experience || "", location: job.location || "", job_type: job.job_type || "",
  }, generation);
  const generatedOn = generation?.generated_at
    ? new Date(generation.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <section className="rounded-xl border border-[#2A3F5E] bg-[#1E3A5F]/40 p-5" data-testid="req-view">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListChecks size={18} className="text-[#00C853]" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Must-Have &amp; Nice-to-Have requirements</h2>
        <button type="button" onClick={onEdit} data-testid="req-view-edit"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-[#00C853] hover:bg-[#00C853]/10">
          <Pencil size={14} /> Edit
        </button>
      </div>
      {generatedOn && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-[#78909C]" data-testid="req-view-generated">
          <Sparkles size={12} className="text-[#00C853]" aria-hidden="true" />
          Generated from the job description on {generatedOn}
          {typeof generation?.cost_usd === "number" && ` · AI cost ${formatUsd(generation.cost_usd)}`}
          {" "}· reviewed and saved by HR
        </p>
      )}
      {changed && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100"
          data-testid="req-view-changed">
          <AlertTriangle size={14} className="text-yellow-300" aria-hidden="true" />
          The job description changed since these were generated. Review them in Edit Job.
        </p>
      )}
      {must.length + nice.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2A3F5E] px-4 py-5 text-center text-sm text-[#B0BEC5]" data-testid="req-view-empty">
          No Must-Have / Nice-to-Have lists yet.{" "}
          <button type="button" onClick={onEdit} className="font-medium text-[#00C853] hover:underline">
            Add or generate them in Edit Job
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {([["Must-Have", must, "must"], ["Nice-to-Have", nice, "nice"]] as const).map(([title, items, key]) => (
            <div key={key} data-testid={`req-view-${key}`}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                {title}
                <span className="rounded-full bg-[#132F4C] px-2 text-xs font-normal text-[#B0BEC5]">{items.length}</span>
              </h3>
              {items.length ? (
                <ul className="space-y-1.5">{items.map((item) => <ViewRow key={item.id} item={item} />)}</ul>
              ) : (
                <p className="text-xs text-[#546E7A]">None.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
