"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";
import { headhuntingAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { HHClaim, HHProspectDetail } from "@/types";
import { DISAGREEMENT, DisclaimerBanner, SOURCE_KIND, StatusChip } from "./HeadhuntingBits";

function claimText(claim: HHClaim | null | undefined) {
  if (!claim?.value) return "unknown";
  const kind = claim.source_kind ? ` (${SOURCE_KIND[claim.source_kind] || claim.source_kind})` : "";
  return `${claim.value}${kind}`;
}

function SideBySide({ label, rules, ai }: { label: string; rules: string; ai: string | null | undefined }) {
  return (
    <tr className="border-b border-[#2A3F5E]/40 align-top">
      <td className="py-1.5 pr-3 text-[#B0BEC5]">{label}</td>
      <td className="py-1.5 pr-3 text-white">{rules}</td>
      <td className="py-1.5 text-white">{ai === undefined ? "—" : ai || "unknown"}</td>
    </tr>
  );
}

export function ProspectDetail({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const [data, setData] = useState<HHProspectDetail | null>(null);

  useEffect(() => {
    headhuntingAPI.prospect(prospectId).then((r) => setData(r.data))
      .catch((e) => { toast.error(getErrorMessage(e, "Could not load the prospect")); onClose(); });
  }, [prospectId, onClose]);

  const evidence = Object.fromEntries((data?.assessment?.evidence_items || []).map((e) => [e.evidence_id, e]));
  const det = data?.deterministic;
  const ai = data?.ai;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-end" onClick={onClose}>
      <motion.aside initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-3xl overflow-y-auto bg-[#1a2a3a] border-l border-[#2A3F5E] p-6 space-y-5"
        role="dialog" aria-label="Prospect evidence">
        {!data ? (
          <div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">{data.display_name}</h2>
                <a href={data.canonical_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#00C853] hover:underline inline-flex items-center gap-1">
                  {data.canonical_url} <ExternalLink size={12} />
                </a>
                {data.headline && <p className="text-sm text-[#B0BEC5] mt-1">{data.headline}</p>}
                <p className="text-xs text-[#546E7A] mt-1">
                  Assessment: {data.assessment_meta?.method === "llm"
                    ? `AI (${data.assessment_meta.model}, ${data.assessment_meta.prompt_version})`
                    : "rules diagnostic (keyword evidence is never more than 'indicated')"}
                  {data.research_note && ` · ${data.research_note.replace(/_/g, " ")}`}
                </p>
              </div>
              <button onClick={onClose} className="text-[#B0BEC5] hover:text-white" aria-label="Close"><X size={20} /></button>
            </div>
            <DisclaimerBanner disclaimers={data.disclaimers} />

            <section>
              <h3 className="text-sm font-semibold text-white mb-2">Requirements</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[#B0BEC5] border-b border-[#2A3F5E]">
                  <th className="py-1.5 pr-2 font-medium">Requirement</th><th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 pr-2 font-medium">Evidence type / activity</th><th className="py-1.5 font-medium">Cited excerpts</th>
                </tr></thead>
                <tbody>
                  {(data.assessment?.requirements || []).map((r) => (
                    <tr key={r.requirement} className="border-b border-[#2A3F5E]/40 align-top">
                      <td className="py-2 pr-2 text-white">{r.requirement}</td>
                      <td className="py-2 pr-2"><StatusChip status={r.status} /></td>
                      <td className="py-2 pr-2 text-xs text-[#B0BEC5]">
                        {(r.basis || "—").replace(/_/g, " ")}
                        {r.activity && r.activity !== "none" && <span className="block">activity: {r.activity}</span>}
                        {r.scope_note && <span className="block text-[#546E7A]">{r.scope_note}</span>}
                        {(r.downgrades || []).length > 0 && <span className="block text-yellow-300">lowered: {r.downgrades.join(", ").replace(/_/g, " ")}</span>}
                        {(r.adjustments || []).length > 0 && <span className="block text-blue-300">{(r.adjustments || []).join(", ").replace(/_/g, " ")}</span>}
                      </td>
                      <td className="py-2 text-xs text-[#B0BEC5] space-y-1">
                        {r.evidence_ids.map((id) => evidence[id] && (
                          <p key={id}><span className="px-1.5 py-0.5 mr-1 rounded bg-[#132F4C] text-[#B0BEC5]">
                            {SOURCE_KIND[evidence[id].source_kind] || evidence[id].source_kind}</span>“{evidence[id].excerpt.slice(0, 220)}”</p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-white mb-2">Location and experience (rules vs AI, never merged)</h3>
              {(data.disagreements || []).length > 0 && (
                <div className="mb-2 space-y-1">
                  {data.disagreements.map((d) => (
                    <p key={d} className="text-xs text-yellow-300 flex items-center gap-1"><AlertTriangle size={12} /> {DISAGREEMENT[d] || d}</p>
                  ))}
                </div>
              )}
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[#B0BEC5] border-b border-[#2A3F5E]">
                  <th className="py-1.5 pr-3 font-medium"></th><th className="py-1.5 pr-3 font-medium">Rules (deterministic)</th>
                  <th className="py-1.5 font-medium">AI</th></tr></thead>
                <tbody>
                  <SideBySide label="Current location" rules={claimText(det?.current_location)} ai={ai ? ai.current_location?.value : undefined} />
                  <SideBySide label="Availability" rules={claimText(det?.availability)} ai={ai ? ai.availability?.value : undefined} />
                  <SideBySide label="Relocation preference" rules={claimText(det?.relocation_preference)} ai={ai ? ai.relocation_preference?.value : undefined} />
                  <SideBySide label="Experience statements"
                    rules={(det?.experience_claims || []).map((c) => `${c.text} (${SOURCE_KIND[c.source_kind] || c.source_kind})`).join("; ") || "unknown"}
                    ai={ai ? ai.experience_statement?.value : undefined} />
                </tbody>
              </table>
              <p className="text-xs text-[#546E7A] mt-1">Location hints (weak, not confirmation): {(det?.location_hints || []).join(", ") || "none"}.
                Experience statements are claims; they are never verified or compared against the minimum automatically.</p>
            </section>

            {(data.assessment?.observations || []).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-white mb-2">Observations (quotes)</h3>
                {data.assessment!.observations.map((o, i) => (
                  <p key={i} className="text-xs text-[#B0BEC5] mb-1">“{o.quote}”{o.note && <span className="text-[#546E7A]"> – {o.note} ({o.strength})</span>}</p>
                ))}
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-white mb-2">Sources</h3>
              <div className="space-y-2">
                {data.search_sources.map((s) => (
                  <div key={s.result_id} className="rounded-lg bg-[#132F4C] p-3 text-xs">
                    <p className="text-[#B0BEC5]"><span className="px-1.5 py-0.5 rounded bg-[#0A1929] mr-1">Search snippet</span>
                      {s.engine} · {s.retrieved_at ? new Date(s.retrieved_at).toLocaleString() : ""}</p>
                    <p className="text-white mt-1">{s.title}</p>
                    <p className="text-[#B0BEC5]">{s.snippet}</p>
                  </div>
                ))}
                {data.fetched_sources.map((s) => (
                  <div key={s.source_id} className="rounded-lg bg-[#132F4C] p-3 text-xs">
                    <p className="text-[#B0BEC5]"><span className="px-1.5 py-0.5 rounded bg-[#0A1929] mr-1">{SOURCE_KIND[s.source_kind] || s.source_kind}</span>
                      {s.outcome} · {s.retrieved_at ? new Date(s.retrieved_at).toLocaleString() : ""} · sha256 {s.sha256?.slice(0, 12) || "—"}</p>
                    <a href={s.final_url || s.url} target="_blank" rel="noopener noreferrer" className="text-[#00C853] hover:underline break-all">{s.final_url || s.url}</a>
                    {s.excerpts.slice(0, 6).map((e, i) => <p key={i} className="text-[#B0BEC5] mt-1">{e.label}: “{e.text}”</p>)}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </motion.aside>
    </div>
  );
}
