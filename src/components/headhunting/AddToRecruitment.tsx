"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/CandidateStatus";
import { headhuntingAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { RecruitmentStatus } from "@/types";

/** Hand a prospect to the Recruitment Agent: shared Candidate Pool + this job. Never triggers an AI call. */
export function AddToRecruitment({ prospectId, onChanged }: { prospectId: string; onChanged?: () => void }) {
  const [info, setInfo] = useState<RecruitmentStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo((await headhuntingAPI.recruitment(prospectId)).data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not check the Candidate Pool"));
    }
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      const res = await headhuntingAPI.addToRecruitment(prospectId);
      const d = res.data;
      const outcome: Record<string, string> = {
        created: "Added to the Candidate Pool and linked to this job",
        created_with_review: "Added as a separate person - an identity review was opened",
        linked_existing: "Linked to the existing pool record with the same profile URL",
        already_added: "Already in the pool - nothing new was created",
      };
      toast.success(outcome[d.identity_outcome] || "Added");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not add to recruitment"));
    } finally {
      setBusy(false);
    }
  };

  if (!info) return null;
  const app = info.application;
  return (
    <section aria-label="Add to Recruitment" className="rounded-lg border border-[#2A3F5E] p-3 space-y-2 text-xs">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><UserPlus size={14} /> Recruitment Agent</h3>
      {info.status === "already_added" && info.pool_candidate ? (
        <div className="space-y-1 text-[#B0BEC5]" data-testid="recruitment-added">
          <p>In the Candidate Pool as <Link className="text-[#00C853] hover:underline"
            href={`/dashboard/candidate-pool/${info.pool_candidate.pool_candidate_id}`}>{info.pool_candidate.display_name || "this person"}</Link>.</p>
          {app ? (
            <p className="flex items-center gap-2">Application for this job: <StatusBadge status={app.processing_status} />
              <Link className="text-[#00C853] hover:underline" href={`/dashboard/candidates/${app.candidate_id}`}>Open</Link></p>
          ) : <p>Not linked to this job yet.</p>}
        </div>
      ) : (
        <div className="space-y-1 text-[#B0BEC5]">
          {info.status === "url_match" && (
            <p data-testid="recruitment-url-match">Same profile URL found in the pool:{" "}
              {info.url_matches.map((m) => m.display_name || "unnamed").join(", ")}.
              {info.url_matches.length === 1 && info.url_matches[0].name_compatible !== false
                ? " The existing record will be reused." : " Names differ: a separate record and an identity review will be created."}</p>
          )}
          {info.status === "possible_matches" && (
            <p className="text-yellow-300 flex items-start gap-1" data-testid="recruitment-possible">
              <AlertTriangle size={12} className="mt-0.5" />
              <span>{`Possibly the same person as ${info.name_matches.map((m) => m.display_name).join(", ")} (name only - not proof). `
                + "A separate record will be created and an identity review opened; nothing is merged automatically."}</span></p>
          )}
          {info.status === "new" && <p>Not in the Candidate Pool yet.</p>}
          <p className="text-[#546E7A]">{info.retention_note}</p>
          {!info.can_add ? <p className="text-[#546E7A]">Adding needs the headhunting.review permission.</p>
            : !info.job_open ? <p className="text-[#546E7A]">The job is closed.</p> : (
              <Button size="sm" isLoading={busy} onClick={add}>Add to Candidate Pool and link to this job</Button>
            )}
          <p className="text-[#546E7A]">No AI analysis runs when adding. Analysis needs a CV and is started separately (paid).</p>
        </div>
      )}
    </section>
  );
}
