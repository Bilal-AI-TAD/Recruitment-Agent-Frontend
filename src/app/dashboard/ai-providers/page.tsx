"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Cpu, FlaskConical, KeyRound, ListRestart, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { aiProvidersAPI } from "@/lib/api";
import { formatUsd } from "@/lib/cost";
import { getErrorMessage } from "@/lib/utils";
import { AiLiveModels, AiModelOption, AiProvider, AiProvidersResponse, AiTestResult } from "@/types";

const inputClass =
  "bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";

function rate(m: AiModelOption): string {
  if (!m.price) return "no price configured – cannot be used";
  return `$${m.price.input} in · $${m.price.output} out per 1M tokens`
    + (m.price.max_input_tokens ? ` · up to ${m.price.max_input_tokens.toLocaleString()} input tokens` : "");
}

function KeyPill({ p }: { p: AiProvider }) {
  if (!p.supported) return <span className="px-2 py-0.5 rounded-full text-xs bg-[#546E7A]/20 text-[#B0BEC5]">Not supported yet</span>;
  if (p.key_source === "dashboard")
    return <span className="px-2 py-0.5 rounded-full text-xs bg-[#00C853]/15 text-[#00C853]">Key set •••• {p.key_last4}</span>;
  if (p.key_source === "env")
    return <span className="px-2 py-0.5 rounded-full text-xs bg-[#00C853]/15 text-[#00C853]">Key from backend .env</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-300">No key</span>;
}

function ProviderCard({ p, data, busy, onRun, onReload }: {
  p: AiProvider; data: AiProvidersResponse; busy: string | null;
  onRun: (key: string, action: () => Promise<void>) => Promise<void>; onReload: () => void;
}) {
  const selected = data.selection.provider === p.provider;
  const [keyInput, setKeyInput] = useState("");
  const [live, setLive] = useState<AiLiveModels | null>(null);
  const options: AiModelOption[] = live ? live.models : p.models;
  const priced = options.filter((m) => m.priced);
  const [model, setModel] = useState<string>(
    selected ? data.selection.model : (p.models.find((m) => m.id === p.default_model)?.id || p.models[0]?.id || ""));
  const [result, setResult] = useState<AiTestResult | null>(null);
  const hasKey = p.key_source !== null;
  const current = options.find((m) => m.id === model);

  const saveKey = () => onRun(`key-${p.provider}`, async () => {
    await aiProvidersAPI.setKey(p.provider, keyInput.trim());
    setKeyInput("");
    toast.success(`${p.label} key saved (encrypted)`);
    onReload();
  });
  const removeKey = () => {
    if (!window.confirm(`Remove the saved ${p.label} key? A key in backend/.env (if any) is used instead.`)) return;
    void onRun(`rm-${p.provider}`, async () => {
      await aiProvidersAPI.removeKey(p.provider);
      toast.success(`${p.label} key removed`);
      onReload();
    });
  };
  const loadLive = () => onRun(`live-${p.provider}`, async () => {
    const res = await aiProvidersAPI.models(p.provider);
    const body = res.data as AiLiveModels;
    setLive(body);
    toast.success(`${body.models.length} models available to this key (${body.models.filter((m) => m.priced).length} priced)`);
  });
  const test = () => onRun(`test-${p.provider}`, async () => {
    const res = await aiProvidersAPI.test(p.provider, model);
    const body = res.data as AiTestResult;
    setResult(body);
    if (body.ok) toast.success(`${p.label} works with ${model}`); else toast.error(body.message || "Test failed");
    onReload();
  });
  const use = () => {
    if (!window.confirm(`Use ${p.label} · ${model} for ALL AI features? Assessments made with another model will show as out of date.`)) return;
    void onRun(`use-${p.provider}`, async () => {
      const res = await aiProvidersAPI.select(p.provider, model);
      const body = res.data as AiProvidersResponse;
      toast.success(`Now using ${p.label} · ${model}`);
      if (body.notice) toast(body.notice, { duration: 6000 });
      onReload();
    });
  };

  return (
    <Card data-testid={`provider-${p.provider}`} className={selected ? "ring-1 ring-[#00C853]" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            {p.label}
            {selected && <span className="px-2 py-0.5 rounded-full text-xs bg-[#00C853] text-[#0A1929]">In use</span>}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1"><KeyPill p={p} /></div>
        </div>
      </div>

      {!p.supported ? (
        <p className="text-sm text-[#546E7A]">This provider&apos;s connection is not built yet, so it cannot be selected.</p>
      ) : (
        <div className="space-y-3">
          {data.can_manage && (
            <div className="flex flex-wrap gap-2 items-center">
              <input type="password" autoComplete="off" className={`${inputClass} flex-1 min-w-[220px]`} value={keyInput}
                placeholder={hasKey ? "Paste a new key to replace it" : `Paste your ${p.label} API key`}
                aria-label={`${p.label} API key`} onChange={(e) => setKeyInput(e.target.value)} />
              <Button size="sm" disabled={!keyInput.trim()} isLoading={busy === `key-${p.provider}`} onClick={saveKey}>
                <KeyRound size={14} className="mr-1" /> Save key
              </Button>
              {p.key_source === "dashboard" && (
                <Button size="sm" variant="danger" isLoading={busy === `rm-${p.provider}`} onClick={removeKey}>
                  <Trash2 size={14} className="mr-1" /> Remove
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <select className={`${inputClass} flex-1 min-w-[220px]`} value={model} aria-label={`${p.label} model`}
              onChange={(e) => { setModel(e.target.value); setResult(null); }} disabled={!data.can_manage}>
              {!options.some((m) => m.id === model) && model && <option value={model}>{model}</option>}
              {priced.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
              {options.filter((m) => !m.priced).map((m) => (
                <option key={m.id} value={m.id} disabled>{m.id} (no price configured)</option>
              ))}
            </select>
            {data.can_manage && (
              <Button size="sm" variant="ghost" disabled={!hasKey} isLoading={busy === `live-${p.provider}`} onClick={loadLive}
                title={hasKey ? "Ask the provider which models this key can use (free)" : "Add a key first"}>
                <ListRestart size={14} className="mr-1" /> Load live models
              </Button>
            )}
          </div>
          {current && <p className="text-xs text-[#546E7A]">{rate(current)}</p>}
          {live && live.priced_not_listed.length > 0 && (
            <p className="text-xs text-yellow-300">Priced here but not offered to this key: {live.priced_not_listed.join(", ")}</p>
          )}

          {data.can_manage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={!hasKey || !current?.priced || !data.can_test}
                isLoading={busy === `test-${p.provider}`} onClick={test}
                title={!data.can_test ? "Testing makes a tiny paid call: it needs the ai.run permission too" : undefined}>
                <FlaskConical size={14} className="mr-1" /> Test
              </Button>
              <Button size="sm" disabled={!hasKey || !current?.priced || (selected && data.selection.model === model)}
                isLoading={busy === `use-${p.provider}`} onClick={use}>
                <CheckCircle2 size={14} className="mr-1" /> Use this model
              </Button>
            </div>
          )}

          {(result || p.last_test) && (
            <div className="bg-[#132F4C] rounded-lg p-3 text-xs" data-testid={`test-result-${p.provider}`}>
              {result ? (
                result.ok ? (
                  <p className="text-[#00C853] flex items-center gap-1"><CheckCircle2 size={14} /> {result.message} Reply:
                    “{result.reply}” · {result.latency_ms} ms · cost {formatUsd(result.cost_usd)}</p>
                ) : (
                  <p className="text-[#FF8A80] flex items-center gap-1"><XCircle size={14} /> {result.message}</p>
                )
              ) : p.last_test && (
                <p className={p.last_test.ok ? "text-[#B0BEC5]" : "text-[#FF8A80]"}>
                  Last test {new Date(p.last_test.at).toLocaleString()} with {p.last_test.model}:
                  {p.last_test.ok ? " OK" : ` failed – ${p.last_test.message}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AiProvidersPage() {
  const [data, setData] = useState<AiProvidersResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await aiProvidersAPI.list();
      setData(res.data as AiProvidersResponse);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) setForbidden(true);
      else toast.error(getErrorMessage(err, "Could not load the AI providers"));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      toast.error(getErrorMessage(err, "The action failed"));
    } finally {
      setBusy(null);
    }
  };

  if (forbidden) {
    return <Card><p className="text-[#B0BEC5]">Viewing the AI providers needs the ai.run or accounts.manage permission.</p></Card>;
  }

  const selected = data?.providers.find((p) => p.provider === data.selection.provider);
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Cpu size={22} /> AI Providers</h1>
        <p className="text-[#B0BEC5]">Choose which AI provider and model the Recruitment Agent uses, add their API keys and test them.
          {data && !data.can_manage && " Only the organization owner can change these settings."}</p>
      </div>

      {!data && <p className="text-sm text-[#B0BEC5]">Loading…</p>}
      {data && (
        <>
          <Card data-testid="ai-selection">
            <CardHeader><CardTitle>Currently used</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-white text-lg">
                {selected?.label || data.selection.provider} · <span className="font-mono">{data.selection.model}</span>
                <span className={`ml-2 align-middle px-2 py-0.5 rounded-full text-xs ${data.selection.usable
                  ? "bg-[#00C853]/15 text-[#00C853]" : "bg-yellow-500/15 text-yellow-300"}`}>
                  {data.selection.usable ? "Ready" : "Not usable yet"}</span>
              </p>
              <p className="text-[#B0BEC5]">
                {data.selection.source === "dashboard" ? "Chosen on this page" : "Default from the backend .env (nothing chosen here yet)"}
                {" · "}used for {data.applies_to.join(", ")}.
              </p>
              {data.selection.issue && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-yellow-200 flex gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{data.selection.issue}</span>
                </div>
              )}
              <p className="text-xs text-[#546E7A]">
                Every call still goes through the shared AI budget and cost log. Only models with a configured price can be
                used. Refusal fallbacks are {data.refusal_fallbacks}. Keys are stored encrypted and never shown again.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.providers.map((p) => (
              <ProviderCard key={`${p.provider}-${data.selection.provider}-${data.selection.model}`} p={p} data={data}
                busy={busy} onRun={run} onReload={load} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
