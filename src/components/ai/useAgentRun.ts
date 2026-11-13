"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentEvent, AgentStreamError, streamAgent } from "@/lib/agentStream";

export type AgentStepStatus = "pending" | "active" | "done" | "failed";
export interface AgentStep { key: string; label: string; status: AgentStepStatus; detail?: string | null }
export type AgentRunStatus = "idle" | "running" | "done" | "failed";

export interface AgentRunHandlers {
  onItem?: (data: any) => void;  
  onReset?: () => void;
  onResult?: (data: any) => void;
}

/** Drives an AI agent route that streams its real progress (step / item / reset / result / error / done events).
 *  `plan` lists the steps expected, shown as pending until the server reports them; any extra step the server
 *  reports (e.g. a retry) is inserted where it happens. Reusable for any streamed AI job. */
export function useAgentRun(plan: { key: string; label: string }[]) {
  const initial = useCallback(() => plan.map((s) => ({ ...s, status: "pending" as AgentStepStatus })), [plan]);
  const [steps, setSteps] = useState<AgentStep[]>(initial);
  const [status, setStatus] = useState<AgentRunStatus>("idle");
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(0);

  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => setElapsedMs(Date.now() - started.current), 100);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => () => abort.current?.abort(), []);     // leaving the form stops listening

  const applyStep = (s: AgentStep) => setSteps((current) => {
    const at = current.findIndex((x) => x.key === s.key);
    if (at >= 0) return current.map((x, i) => (i === at ? { ...x, ...s } : x));
    const lastSeen = current.reduce((n, x, i) => (x.status !== "pending" ? i : n), -1);
    return [...current.slice(0, lastSeen + 1), s, ...current.slice(lastSeen + 1)];
  });

  const run = useCallback(async (path: string, body: unknown, handlers: AgentRunHandlers = {}) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSteps(initial());
    setError(null);
    setCostUsd(null);
    setElapsedMs(0);
    started.current = Date.now();
    setStatus("running");
    let failed = false;
    let gotResult = false;
    const onEvent = ({ event, data }: AgentEvent) => {
      if (controller.signal.aborted) return;
      if (event === "step") applyStep(data as AgentStep);
      else if (event === "item") handlers.onItem?.(data);
      else if (event === "reset") handlers.onReset?.();
      else if (event === "result") {
        gotResult = true;
        if (typeof data?.cost?.cost_usd === "number") setCostUsd(data.cost.cost_usd);
        handlers.onResult?.(data);
      } else if (event === "error") {
        failed = true;
        setError({ code: data?.code, message: data?.message || "Generation failed." });
      }
    };
    try {
      await streamAgent(path, body, onEvent, controller.signal);
      if (controller.signal.aborted) return;
      if (!failed && !gotResult) {                        // the connection closed before the answer arrived
        failed = true;
        setError({ code: "STREAM_ENDED", message: "The connection closed before the result arrived. Try again." });
      }
      setElapsedMs(Date.now() - started.current);
      setStatus(failed ? "failed" : "done");
    } catch (e) {
      if (controller.signal.aborted || (e as Error).name === "AbortError") return;
      const err = e as AgentStreamError;
      setError({ code: err.code, message: err.message || "Could not reach the server." });
      setElapsedMs(Date.now() - started.current);
      setStatus("failed");
    }
  }, [initial]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    setStatus((s) => (s === "running" ? "idle" : s));
  }, []);

  return { steps, status, error, elapsedMs, costUsd, run, cancel };
}
