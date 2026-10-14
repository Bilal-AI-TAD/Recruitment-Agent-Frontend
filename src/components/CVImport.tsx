"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { configAPI, jobsAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { AppConfig, CVImportSummary } from "@/types";

interface CVImportProps {
  jobId: string;
  disabled?: boolean;
  disabledReason?: string;
  onImported?: (summary: CVImportSummary) => void;
}

const DEFAULT_ACCEPT = [".pdf", ".docx", ".zip"];

const statusStyles = {
  imported: { icon: CheckCircle2, className: "text-[#00C853]", label: "Imported" },
  duplicate: { icon: AlertTriangle, className: "text-yellow-400", label: "Duplicate" },
  rejected: { icon: XCircle, className: "text-[#FF5252]", label: "Rejected" },
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CVImport({ jobId, disabled, disabledReason, onImported }: CVImportProps) {
  const [config, setConfig] = useState<AppConfig["cv_import"] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [summary, setSummary] = useState<CVImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    configAPI.get()
      .then((response) => setConfig(response.data.cv_import))
      .catch(() => setConfig(null));
  }, []);

  const accepted = config ? [...config.cv_extensions, ...config.archive_extensions] : DEFAULT_ACCEPT;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    const unsupported = list.filter((file) => !accepted.some((ext) => file.name.toLowerCase().endsWith(ext)));
    if (unsupported.length) {
      toast.error(`Not supported: ${unsupported.map((f) => f.name).join(", ")}. Use ${accepted.join(", ")}.`);
    }
    const supported = list.filter((file) => !unsupported.includes(file));
    setFiles((current) => {
      const names = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...supported.filter((f) => !names.has(`${f.name}:${f.size}`))];
    });
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setIsUploading(true);
    try {
      const response = await jobsAPI.importCVs(jobId, files);
      const result: CVImportSummary = response.data;
      setSummary(result);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      const parts = [`${result.imported} imported`];
      if (result.duplicate) parts.push(`${result.duplicate} duplicate`);
      if (result.rejected) parts.push(`${result.rejected} rejected`);
      (result.imported ? toast.success : toast.error)(parts.join(", "));
      onImported?.(result);
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          isDragging ? "border-[#00C853] bg-[#00C853]/5" : "border-[#2A3F5E]",
          disabled && "opacity-50"
        )}
      >
        <Upload className="mx-auto mb-2 text-[#B0BEC5]" size={28} />
        <p className="text-white text-sm font-medium">Drag &amp; drop CVs here, or</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accepted.join(",")}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          disabled={disabled}
        />
        <p className="text-xs text-[#B0BEC5] mt-3">
          Supported formats: {config?.supported_formats_text || "PDF (.pdf), Word (.docx), or a ZIP (.zip) containing PDF/DOCX files"}
        </p>
        {config && (
          <p className="text-xs text-[#B0BEC5] mt-1">
            Up to {config.max_cv_file_mb} MB per CV · ZIP up to {config.max_zip_file_mb} MB and {config.max_zip_entries} files ·
            {" "}{config.max_files_per_request} files per upload
          </p>
        )}
        {disabled && disabledReason && <p className="text-xs text-yellow-400 mt-2">{disabledReason}</p>}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={`${file.name}:${file.size}`} className="flex items-center justify-between bg-[#132F4C] rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-white truncate">
                  <FileText size={14} className="text-[#B0BEC5] flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-[#B0BEC5] text-xs">{formatSize(file.size)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                  className="text-[#B0BEC5] hover:text-white"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <Button onClick={handleUpload} isLoading={isUploading} disabled={disabled}>
            Upload {files.length} file{files.length === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      {summary && (
        <div className="bg-[#132F4C] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white text-sm font-semibold">
              Upload results: {summary.imported} imported · {summary.duplicate} duplicate · {summary.rejected} rejected
            </h4>
            <button type="button" onClick={() => setSummary(null)} className="text-[#B0BEC5] hover:text-white" aria-label="Dismiss results">
              <X size={16} />
            </button>
          </div>
          {summary.processing_blocked && summary.processing_blocked.length > 0 && (
            <p className="text-xs text-yellow-300 mb-3" data-testid="processing-blocked">
              Imported, but not analysed yet – they stay Pending: {summary.processing_blocked[0].message}
            </p>
          )}
          {summary.queued_for_processing > 0 && (
            <p className="text-xs text-[#B0BEC5] mb-3">
              {summary.queued_for_processing} CV(s) are being extracted and matched by AI. The ranking updates automatically.
            </p>
          )}
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {summary.results.map((result, index) => {
              const style = statusStyles[result.status];
              const Icon = style.icon;
              return (
                <li key={`${result.filename}-${index}`} className="flex items-start gap-2 text-sm">
                  <Icon size={16} className={cn("mt-0.5 flex-shrink-0", style.className)} />
                  <div className="min-w-0">
                    <span className="text-white break-all">{result.filename}</span>
                    <span className={cn("ml-2 text-xs", style.className)}>{style.label}</span>
                    {result.reason && <p className="text-xs text-[#B0BEC5]">{result.reason}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
