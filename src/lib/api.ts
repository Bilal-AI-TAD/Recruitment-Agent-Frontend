import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v3";

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
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => api.post("/user/login", { email, password }),
  register: (data: { first_name: string; last_name: string; email: string; password: string; role: string }) =>
    api.post("/user/register", data),
  validateToken: () => api.get("/user/me"),
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
  /** Queue every pending CV of the job for AI extraction and matching. */
  parseAndScore: (jobId: string) => api.post(`/jobs/${jobId}/process`),
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
  addNote: (poolCandidateId: string, body: string, jobId?: string | null) =>
    api.post(`/pool/candidates/${poolCandidateId}/notes`, { body, job_id: jobId || null }),
  updateNote: (noteId: string, body: string) => api.patch(`/pool/notes/${noteId}`, { body }),
  deleteNote: (noteId: string) => api.delete(`/pool/notes/${noteId}`),
  downloadDocument: (documentId: string) => api.get(`/pool/documents/${documentId}/file`, { responseType: "blob" }),
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

/** Read-only Gmail connection and historical CV import (see backend docs/gmail_integration.md). */
export const gmailAPI = {
  connections: () => api.get("/integrations/gmail/connections"),
  connect: (nonce: string, connectionId?: string) =>
    api.post("/integrations/gmail/connect", { nonce, ...(connectionId ? { connection_id: connectionId } : {}) }),
  complete: (flowId: string, nonce: string) => api.post("/integrations/gmail/complete", { flow_id: flowId, nonce }),
  check: (connectionId: string) => api.post(`/integrations/gmail/connections/${connectionId}/check`),
  disconnect: (connectionId: string) => api.post(`/integrations/gmail/connections/${connectionId}/disconnect`),
  shareableUsers: () => api.get("/integrations/gmail/shareable-users"),
  setShares: (connectionId: string, userIds: string[]) =>
    api.put(`/integrations/gmail/connections/${connectionId}/shares`, { user_ids: userIds }),
  variants: (jobId: string) => api.get(`/integrations/gmail/jobs/${jobId}/variants`),
  regenerateVariants: (jobId: string) => api.post(`/integrations/gmail/jobs/${jobId}/variants/regenerate`),
  saveVariants: (jobId: string, variants: string[]) => api.put(`/integrations/gmail/jobs/${jobId}/variants`, { variants }),
  search: (data: { connection_id: string; job_id: string; variants: string[]; date_from?: string; date_to?: string;
                   mode?: "narrow" | "broad"; confirm_broad?: boolean }) => api.post("/integrations/gmail/searches", data),
  more: (searchId: string) => api.post(`/integrations/gmail/searches/${searchId}/more`),
  startImport: (data: { search_id: string; selections: { message_id: string; part_ids: string[] }[];
                        client_request_id: string }) => api.post("/integrations/gmail/imports", data),
  imports: (jobId: string) => api.get("/integrations/gmail/imports", { params: { job_id: jobId } }),
  run: (runId: string) => api.get(`/integrations/gmail/imports/${runId}`),
  cancel: (runId: string) => api.post(`/integrations/gmail/imports/${runId}/cancel`),
  retry: (runId: string) => api.post(`/integrations/gmail/imports/${runId}/retry`),
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
};

export const resumesAPI = {
  upload: (data: FormData) => api.post("/resumes/upload", data),
};

export const analyticsAPI = {
  getDashboardMetrics: () => api.get("/analytics/dashboard-metrics"),
  getTokenUsage: (period: string = "daily") => api.get("/analytics/token-usage", { params: { period } }),
  getTokenSummary: () => api.get("/analytics/token-summary"),
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

/** Open (PDF) or download (DOCX) an original CV version from the pool, with authentication. */
export async function openPoolDocument(documentId: string, filename?: string | null, download = false) {
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
