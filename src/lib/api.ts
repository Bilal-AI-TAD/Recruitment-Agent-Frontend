import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL
  // The local fallback exists only for development; production builds require the variable (next.config.ts).
  || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000/api/v3");

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || "";
    const isAuthCall = url.includes("/user/login") || url.includes("/user/register");
    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthCall) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      const publicPage = ["/login", "/register", "/accept-invitation"].some((p) => window.location.pathname.startsWith(p));
      if (!publicPage) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => api.post("/user/login", { email, password }),
  validateToken: () => api.get("/user/me"),
};

/** Owner-approved accounts: public access requests + invitation redemption, and the owner's Accounts page. */
export const accountsAPI = {
  requestAccess: (data: { email: string; first_name: string; last_name: string; note?: string }) =>
    api.post("/account-requests", data),
  inspectInvitation: (token: string) => api.post("/invitations/inspect", { token }),
  acceptInvitation: (data: { token: string; email: string; password: string; first_name: string; last_name: string }) =>
    api.post("/invitations/accept", data),
  permissions: () => api.get("/accounts/permissions"),
  requests: (status = "pending") => api.get("/accounts/requests", { params: { status } }),
  approve: (requestId: string, permissions: string[]) =>
    api.post(`/accounts/requests/${requestId}/approve`, { permissions }),
  reject: (requestId: string, reason?: string) => api.post(`/accounts/requests/${requestId}/reject`, { reason }),
  members: () => api.get("/accounts/members"),
  setPermissions: (userId: string, permissions: string[]) =>
    api.put(`/accounts/members/${userId}/permissions`, { permissions }),
  setStatus: (userId: string, status: "active" | "disabled") => api.put(`/accounts/members/${userId}/status`, { status }),
  invitations: () => api.get("/accounts/invitations"),
  invite: (email: string, permissions: string[]) => api.post("/accounts/invitations", { email, permissions }),
  revoke: (invitationId: string) => api.post(`/accounts/invitations/${invitationId}/revoke`),
  reissue: (invitationId: string) => api.post(`/accounts/invitations/${invitationId}/reissue`),
  audit: () => api.get("/accounts/audit"),
};

export const configAPI = {
  get: () => api.get("/config/"),
};

export const jobsAPI = {
  getAll: () => api.get("/jobs/"),
  getById: (jobId: string) => api.get(`/jobs/${jobId}`),
  create: (data: Record<string, unknown>) => api.post("/jobs/", data),
  update: (jobId: string, data: Record<string, unknown>) => api.patch(`/jobs/${jobId}`, data),
  delete: (jobId: string) => api.delete(`/jobs/${jobId}`),
  importCVs: (jobId: string, files: File[], autoProcess = true) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("auto_process", String(autoProcess));
    return api.post(`/jobs/${jobId}/cvs`, form);
  },
  processPending: (jobId: string) => api.post(`/jobs/${jobId}/process`),
  ranking: (jobId: string) => api.get(`/jobs/${jobId}/ranking`),
};

export const candidatesAPI = {
  getAll: (jobId?: string, search?: string, shortlistOnly?: boolean) =>
    api.get("/candidates/", { params: { job_id: jobId, search, shortlist_only: shortlistOnly } }),
  getById: (candidateId: string) => api.get(`/candidates/${candidateId}`),
  create: (data: Record<string, unknown>) => api.post("/candidates/", data),
  update: (candidateId: string, data: Record<string, unknown>) => api.patch(`/candidates/${candidateId}`, data),
  delete: (candidateId: string) => api.delete(`/candidates/${candidateId}`),
  toggleShortlist: (candidateId: string) => api.patch(`/candidates/${candidateId}/shortlist`),
  assessment: (candidateId: string) => api.get(`/candidates/${candidateId}/assessment`),
  retry: (candidateId: string) => api.post(`/candidates/${candidateId}/retry`),
  reassess: (candidateId: string) => api.post(`/candidates/${candidateId}/reassess`),
  downloadCV: (candidateId: string) => api.get(`/candidates/${candidateId}/cv`, { responseType: "blob" }),
  cvLink: (candidateId: string) => api.get<CvLink>(`/candidates/${candidateId}/cv/link`),
  /** Queue every pending CV of the job for AI extraction and matching. */
  parseAndScore: (jobId: string) => api.post(`/jobs/${jobId}/process`),
  /** Headhunted applications: attach an HR-supplied CV (no AI call) and request the paid AI analysis. */
  attachCV: (candidateId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/candidates/${candidateId}/cv`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  analysis: (candidateId: string) => api.get(`/candidates/${candidateId}/analysis`),
  confirmCvIdentity: (candidateId: string) => api.post(`/candidates/${candidateId}/confirm-cv-identity`),
  requestAnalysis: (candidateId: string) =>
    api.post(`/candidates/${candidateId}/analysis`, { client_request_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) }),
  getScoresByJob: (jobId: string) => api.get(`/jobs/${jobId}/ranking`),
};

export interface PoolSearchParams {
  q?: string;
  skills?: string[];
  languages?: string[];
  role?: string;
  certification?: string;
  min_years?: number;
  max_years?: number;
  include_uncertain?: boolean;
  include_unknown?: boolean;
  sources?: string[];
  added_from?: string;
  added_to?: string;
  job_id?: string;
  exclude_in_job?: boolean;
  needs_review?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
}

/** Shared Candidate Pool. Viewing, searching and filtering never call the AI. */
export const poolAPI = {
  search: (params: PoolSearchParams) => api.get("/pool/candidates", { params, paramsSerializer: { indexes: null } }),
  facets: () => api.get("/pool/facets"),
  get: (poolCandidateId: string) => api.get(`/pool/candidates/${poolCandidateId}`),
  remove: (poolCandidateId: string, withApplications = false) =>
    api.delete(`/pool/candidates/${poolCandidateId}`, { params: { with_applications: withApplications } }),
  setCurrentDocument: (poolCandidateId: string, documentId: string) =>
    api.post(`/pool/candidates/${poolCandidateId}/current-document`, { document_id: documentId }),
  addNote: (poolCandidateId: string, body: string, jobId?: string | null, kind: "note" | "contact" = "note") =>
    api.post(`/pool/candidates/${poolCandidateId}/notes`, { body, job_id: jobId || null, kind }),
  updateNote: (noteId: string, body: string) => api.patch(`/pool/notes/${noteId}`, { body }),
  deleteNote: (noteId: string) => api.delete(`/pool/notes/${noteId}`),
  downloadDocument: (documentId: string) => api.get(`/pool/documents/${documentId}/file`, { responseType: "blob" }),
  documentLink: (documentId: string) => api.get<CvLink>(`/pool/documents/${documentId}/link`),
  retryDocument: (documentId: string) => api.post(`/pool/documents/${documentId}/retry`),
  dismissReview: (reviewId: string) => api.post(`/pool/identity-reviews/${reviewId}/dismiss`),
  mergeReview: (reviewId: string, keepCandidateId: string) =>
    api.post(`/pool/identity-reviews/${reviewId}/merge`, { keep_candidate_id: keepCandidateId }),
  undoMerge: (mergeId: string) => api.post(`/pool/merges/${mergeId}/undo`),
  confirmPresent: (poolCandidateId: string, asOf?: string) =>
    api.post(`/pool/candidates/${poolCandidateId}/confirm-present`, { as_of: asOf || null }),
  clearPresent: (poolCandidateId: string) => api.delete(`/pool/candidates/${poolCandidateId}/confirm-present`),
  addToJob: (jobId: string, poolCandidateIds: string[]) =>
    api.post(`/jobs/${jobId}/applications`, { pool_candidate_ids: poolCandidateIds }),
};

/** Mailbox connections (the company Outlook mailbox), subject phrases and CV import runs (backend docs/outlook.md). */
export const mailImportAPI = {
  connections: () => api.get("/integrations/mail/connections"),
  check: (connectionId: string) => api.post(`/integrations/mail/connections/${connectionId}/check`),
  disconnect: (connectionId: string) => api.post(`/integrations/mail/connections/${connectionId}/disconnect`),
  shareableUsers: () => api.get("/integrations/mail/shareable-users"),
  setShares: (connectionId: string, userIds: string[]) =>
    api.put(`/integrations/mail/connections/${connectionId}/shares`, { user_ids: userIds }),
  variants: (jobId: string) => api.get(`/integrations/mail/jobs/${jobId}/variants`),
  regenerateVariants: (jobId: string, useAi = false) =>
    api.post(`/integrations/mail/jobs/${jobId}/variants/regenerate`, null, { params: useAi ? { use_ai: true } : {} }),
  previewVariants: (jobId: string, variants: string[], subjects: string[]) =>
    api.post(`/integrations/mail/jobs/${jobId}/variants/preview`, { variants, subjects }),
  saveVariants: (jobId: string, variants: string[]) => api.put(`/integrations/mail/jobs/${jobId}/variants`, { variants }),
  search: (data: { connection_id: string; job_id?: string | null; variants: string[]; date_from?: string; date_to?: string;
                   mode?: "narrow" | "broad"; confirm_broad?: boolean }) => api.post("/integrations/mail/searches", data),
  more: (searchId: string) => api.post(`/integrations/mail/searches/${searchId}/more`),
  startImport: (data: { search_id: string; selections: { message_id: string; part_ids: string[]; confirm_job?: boolean }[];
                        client_request_id: string }) => api.post("/integrations/mail/imports", data),
  imports: (jobId?: string | null) => api.get("/integrations/mail/imports", { params: jobId ? { job_id: jobId } : {} }),
  run: (runId: string) => api.get(`/integrations/mail/imports/${runId}`),
  cancel: (runId: string) => api.post(`/integrations/mail/imports/${runId}/cancel`),
  retry: (runId: string) => api.post(`/integrations/mail/imports/${runId}/retry`),
};

/** The company Outlook mailbox (Microsoft Graph): connection, reply tracking. See backend docs/outlook.md. */
export const outlookAPI = {
  status: () => api.get("/integrations/outlook"),
  connect: (nonce: string) => api.post("/integrations/outlook/connect", { nonce }),
  complete: (flowId: string, nonce: string) => api.post("/integrations/outlook/complete", { flow_id: flowId, nonce }),
  connectApp: () => api.post("/integrations/outlook/connect-app"),
  syncReplies: () => api.post("/integrations/outlook/sync-replies"),
};

/** Outbox: candidate e-mails need a separate, recorded approval; nothing is sent without it. */
export const mailAPI = {
  outbox: (status?: string) => api.get("/mail/outbox", { params: status ? { status } : {} }),
  message: (outboxId: string) => api.get(`/mail/outbox/${outboxId}`),
  edit: (outboxId: string, subject: string, body: string) => api.put(`/mail/outbox/${outboxId}`, { subject, body }),
  approve: (outboxId: string, contentHash: string) =>
    api.post(`/mail/outbox/${outboxId}/approve`, { content_hash: contentHash }),
  cancel: (outboxId: string) => api.post(`/mail/outbox/${outboxId}/cancel`),
  resolve: (outboxId: string, outcome: "sent" | "not_sent") => api.post(`/mail/outbox/${outboxId}/resolve`, { outcome }),
  thread: (applicationId: string) => api.get(`/candidates/${applicationId}/messages`),
  templates: (applicationId: string) => api.get(`/candidates/${applicationId}/messages/templates`),
  compose: (applicationId: string, data: { template: string; subject: string; body: string; client_request_id: string }) =>
    api.post(`/candidates/${applicationId}/messages`, data),
  optOut: (applicationId: string) => api.post(`/candidates/${applicationId}/opt-out`),
  suppressions: () => api.get("/mail/suppressions"),
};

export const headhuntingAPI = {
  config: () => api.get("/headhunting/config"),
  start: (jobId: string, data: { mode: string; location: string; client_request_id: string;
                                 limits?: Record<string, number> }) => api.post(`/jobs/${jobId}/headhunting/runs`, data),
  runs: (jobId: string) => api.get(`/jobs/${jobId}/headhunting/runs`),
  run: (runId: string) => api.get(`/headhunting/runs/${runId}`),
  cancel: (runId: string) => api.post(`/headhunting/runs/${runId}/cancel`),
  retry: (runId: string) => api.post(`/headhunting/runs/${runId}/retry`),
  prospects: (runId: string, params?: Record<string, string | number>) =>
    api.get(`/headhunting/runs/${runId}/prospects`, { params }),
  prospect: (prospectId: string) => api.get(`/headhunting/prospects/${prospectId}`),
  review: (jobId: string, data: { canonical_url: string; status: string; note?: string | null }) =>
    api.put(`/headhunting/jobs/${jobId}/reviews`, data),
  retention: (prospectId: string) => api.get(`/headhunting/prospects/${prospectId}/retention`),
  recruitment: (prospectId: string) => api.get(`/headhunting/prospects/${prospectId}/recruitment`),
  addToRecruitment: (prospectId: string) => api.post(`/headhunting/prospects/${prospectId}/recruitment`, {}),
  extend: (jobId: string, data: { canonical_url: string; days: number; reason_code: string; note?: string | null }) =>
    api.post(`/headhunting/jobs/${jobId}/retention/extend`, data),
  deleteNow: (data: { canonical_url: string; reason_code: string; suppress: boolean }) =>
    api.post("/headhunting/retention/delete", data),
};

export const resumesAPI = {
  upload: (data: FormData) => api.post("/resumes/upload", data),
};

export interface UsageRange { start: string; end: string; granularity: "day" | "week" }

export const analyticsAPI = {
  getDashboardMetrics: () => api.get("/analytics/dashboard-metrics"),
  /** Legacy "daily"/"weekly", or an explicit UTC date range (YYYY-MM-DD, inclusive) by day or week. */
  getTokenUsage: (range: string | UsageRange = "daily") =>
    api.get("/analytics/token-usage", { params: typeof range === "string" ? { period: range } : range }),
  getTokenSummary: (range?: { start?: string; end?: string }) => api.get("/analytics/token-summary", { params: range || {} }),
  getAiReadiness: (headhunted = false) => api.get("/analytics/ai-readiness", { params: { headhunted } }),
  getStorageStatus: () => api.get("/analytics/storage-status"),
  getRecentActivity: (limit = 10) => api.get("/analytics/recent-activity", { params: { limit } }),
  getScoreDistribution: () => api.get("/analytics/score-distribution"),
};

/** Optional legacy integration; only usable when the backend reports features.visnext_sync = true. */
export const visnextAPI = {
  fetchJobs: () => api.get("/visnext/fetch_jobs"),
};

// The APIs below belong to AI calls / interview scheduling, which are not part of the current release.
export const scheduleAPI = {
  updateAgent: (candidateId: string, jobId: string) => api.post(`/interviews/update-agent/${candidateId}/${jobId}`),
};

export const interviewsDataAPI = {
  getAll: () => api.get("/interviews-data/all"),
};

export const elevenlabsAPI = {
  getConversation: (conversationId: string) => api.get(`/elevenlabs/conversation/${conversationId}`),
  getCandidateLatestConversation: (candidateId: string) =>
    api.get(`/elevenlabs/candidate/${candidateId}/latest-conversation`),
};

function openBlob(blob: Blob, filename?: string | null) {
  const url = URL.createObjectURL(blob);
  if (blob.type === "application/pdf") {
    window.open(url, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "cv";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Authorised access to a stored CV: private cloud files come as a short-lived signed link (opened directly);
 *  local files are streamed by the backend ("stream"); external links are opened as they are. */
export interface CvLink { mode: "link" | "stream" | "external"; url: string | null; expires_at: number | null;
  filename: string | null }

function openSignedLink(link: CvLink): boolean {
  if ((link.mode === "link" || link.mode === "external") && link.url) {
    window.open(link.url, "_blank", "noopener");
    return true;
  }
  return false;
}

/** Open (PDF) or download (DOCX) an original CV version from the pool, with authentication. */
export async function openPoolDocument(documentId: string, filename?: string | null, download = false) {
  if (openSignedLink((await poolAPI.documentLink(documentId)).data)) return;
  const response = await poolAPI.downloadDocument(documentId);
  const blob: Blob = response.data;
  if (download) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "cv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  openBlob(blob, filename);
}

/** Open a CV in a new tab (PDF) or download it (DOCX) using the authenticated API. */
export async function openCandidateCV(candidateId: string, filename?: string | null) {
  if (openSignedLink((await candidatesAPI.cvLink(candidateId)).data)) return;
  const response = await candidatesAPI.downloadCV(candidateId);
  const blob: Blob = response.data;
  const url = URL.createObjectURL(blob);
  if (blob.type === "application/pdf") {
    window.open(url, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "cv";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default api;
