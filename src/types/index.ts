export interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  /** Explicit server-granted permissions, e.g. "pool.remove", "pool.merge". Enforced by the backend. */
  permissions?: string[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface Job {
  job_id: string;
  title: string;
  company?: string;
  location?: string;
  job_type?: string;
  requirements?: string;
  about_role?: string;
  required_experience?: string;
  open_positions?: number;
  job_available?: boolean;
  created_at?: string;
  updated_at?: string;
  candidate_count?: number;
  candidates?: Candidate[];
}

export interface Candidate {
  candidate_id: string;
  job_id: string;
  name: string;
  email: string;
  phone?: string;
  resume_url?: string;
  shortlist: boolean;
  parsed_resumes?: ParsedResume[];
  scores?: CandidateScore[];
}

export interface ParsedResume {
  parsed_resume_id: string;
  candidate_id: string;
  job_id: string;
  personal_info: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  summary_objective: Record<string, unknown>;
  experience: Experience[];
  skills: {
    technical?: string[];
    soft?: string[];
  };
  projects: Project[];
  education: Education[];
  certifications_courses: Certification[];
  raw_text?: {
    parsed_data?: string;
    tokens_info?: TokensInfo;
  };
}

export interface Experience {
  title: string;
  company: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface Project {
  name: string;
  description?: string;
  technologies?: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  graduation_year?: string;
}

export interface Certification {
  name: string;
  issuer?: string;
  date?: string;
}

export interface CandidateScore {
  score_id: string;
  candidate_id: string;
  job_id: string;
  parsed_resume_id: string;
  candidate_scores: {
    experience_impact_score?: number;
    technical_skills_score?: number;
    education_certifications_score?: number;
    growth_potential_score?: number;
    soft_skills_score?: number;
    cultural_fit_score?: number;
    leadership_ownership_score?: number;
    general_fit_score?: number;
    evaluation_reasons?: string;
  };
  total_score: number;
}

export interface Interview {
  interview_id: string;
  candidate_id: string;
  job_id: string;
  interviewer_id: string;
  scheduled_time: string;
  status: string;
  candidate?: Candidate;
  job?: Job;
  interviewer?: Interviewer;
}

export interface Interviewer {
  interviewer_id: string;
  name: string;
  email: string;
  availability: Record<string, unknown>;
}

export interface APILog {
  log_id: string;
  route: string;
  method: string;
  operation_type: string;
  model_used: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  cost_usd: number;
  processing_time_ms: number;
  user_id?: string;
  job_id?: string;
  candidate_id?: string;
  created_at: string;
}

export interface TokensInfo {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
  estimated_price_usd?: number;
}

export interface DashboardMetrics {
  totalJobs: number;
  totalCandidates: number;
  avgScore: number;
  interviewsToday: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  candidate_id?: string;
  job_id?: string;
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed" | "duplicate";

export interface CVImportResult {
  filename: string;
  status: "imported" | "duplicate" | "rejected";
  reason?: string | null;
  candidate_id?: string | null;
}

export interface CVImportSummary {
  total: number;
  imported: number;
  duplicate: number;
  rejected: number;
  queued_for_processing: number;
  results: CVImportResult[];
}

export interface AppConfig {
  company_name: string;
  cv_import: {
    cv_extensions: string[];
    archive_extensions: string[];
    supported_formats_text: string;
    max_cv_file_mb: number;
    max_zip_file_mb: number;
    max_zip_entries: number;
    max_zip_uncompressed_mb: number;
    max_files_per_request: number;
  };
  features: { visnext_sync: boolean; gmail?: boolean; gmail_setup_issue?: string | null };
}

export interface AssessmentCriterion {
  key: string;
  label: string;
  max: number;
  score: number;
  evidence: string[];
}

export interface AssessmentStrength {
  point: string;
  evidence: string;
}

export interface MissingRequirement {
  requirement: string;
  status: "not_found" | "partial" | "unclear";
  note: string;
}

export interface Assessment {
  criteria: AssessmentCriterion[];
  strengths: AssessmentStrength[];
  missing_requirements: MissingRequirement[];
  summary: string;
  total_score: number;
  is_stale: boolean;
  stale_reasons?: StaleReason[];
  assessed_at?: string | null;
  scoring_version?: string | null;
  llm?: { provider?: string; model?: string };
}

export interface StaleReason {
  code: "job_changed" | "newer_cv_version" | "profile_reextracted" | "scoring_changed" | "model_changed";
  label: string;
}

interface CandidateCore {
  candidate_id: string;
  job_id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  source?: string;
  resume_filename?: string | null;
  resume_content_type?: string | null;
  resume_is_remote: boolean;
  resume_url?: string | null;
  has_resume: boolean;
  processing_status: ProcessingStatus;
  processing_error?: string | null;
  processed_at?: string | null;
  duplicate_of_candidate_id?: string | null;
  shortlist: boolean;
  created_at?: string | null;
  pool_candidate_id?: string | null;
  added_via?: "upload" | "pool" | "manual" | "gmail";
  cv_version?: number | null;
  profile_version?: number | null;
}

export interface RankedCandidate extends CandidateCore {
  rank: number | null;
  total_score: number | null;
  summary: string | null;
  strengths: AssessmentStrength[];
  missing_requirements: MissingRequirement[];
  is_stale: boolean;
  stale_reasons: StaleReason[];
  extraction_review_flags?: string[];
  open_identity_reviews?: number;
  /** Application e-mail for Gmail imports. The sender may be an agency or a colleague, not the candidate. */
  gmail?: GmailEmailView | null;
  profile: {
    current_title?: string | null;
    current_company?: string | null;
    key_skills: string[];
    highest_education?: string | null;
    roles_count: number;
  } | null;
}

export interface JobRanking {
  job_id: string;
  job_title: string;
  total_candidates: number;
  status_counts: Record<ProcessingStatus, number>;
  candidates: RankedCandidate[];
}

export interface CandidateAssessment extends CandidateCore {
  job_title?: string | null;
  profile: Record<string, unknown> | null;
  assessment: Assessment | null;
}

// ---------------------------------------------------------------------------- Candidate Pool

/** Source support = the value can be traced to the CV text. It is not independent verification. */
export type SourceSupport =
  | "in_section" | "in_entry" | "elsewhere"            // traced to the CV text
  | "partial" | "not_found_verbatim" | "no_text_layer"; // uncertain (maybe paraphrased / scanned)

export type FilterStatus = "match" | "uncertain" | "unknown" | "not_listed" | "outside";

export interface PoolListItem {
  pool_candidate_id: string;
  name: string | null;
  status: "provisional" | "active" | "merged";
  current_title: string | null;
  current_employer: string | null;
  experience_months: { min: number | null; max: number | null };
  top_skills: { name: string; support: SourceSupport }[];
  languages: { name: string; support: SourceSupport }[];
  sources: string[];
  documents: number;
  jobs: { job_id: string; title: string }[];
  in_job: boolean;
  extraction_status: string;
  has_profile: boolean;
  review_flag_count: number;
  current_needs_review: boolean;
  review_codes: string[];
  experience_as_of: string | null;
  added_at: string | null;
  filter_status: Record<string, FilterStatus>;
}

export interface PoolSearchResult {
  items: PoolListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  /** Matches if uncertain and unknown values were included (null when not applicable). */
  broader_total: number | null;
}

export interface PoolFacets {
  skills: { value: string; count: number }[];
  languages: { value: string; count: number }[];
  sources: { value: string; count: number }[];
  total_candidates: number;
}

export interface ValidationFlag {
  code: string;
  severity: "info" | "review";
  field: string | null;
  message: string;
}

export interface ParsedDate {
  value?: string;
  precision?: "year" | "month";
  is_present?: boolean;
  unparsed?: boolean;
  raw?: string;
}

export interface ProfileFacts {
  contact: Record<string, { value: string; support?: SourceSupport }>;
  skills: { name: string; group: string; support: SourceSupport; found_in?: string[] }[];
  languages: { name: string; as_written: string; support: SourceSupport }[];
  certifications: { name: string; issuer?: string | null; date?: string | null; support: SourceSupport }[];
  education: { degree?: string | null; institution?: string | null; dates?: string | null;
               degree_support?: SourceSupport | null; institution_support?: SourceSupport | null }[];
  roles: { index: number; title?: string | null; employer?: string | null; start?: ParsedDate | null;
           end?: ParsedDate | null; dates_as_written?: string | null; support: SourceSupport;
           title_support?: SourceSupport | null; employer_support?: SourceSupport | null }[];
}

export interface PoolProfile {
  sections: Record<string, any> | null;
  facts: ProfileFacts | null;
  derived: { experience?: { months_min: number | null; months_max: number | null; status: string; as_of: string;
             excluded: { index: number; reason: string }[]; overlaps: number[][] } } | null;
  validation: { status: string; flags: ValidationFlag[]; issues: string[]; sensitive_removed: string[];
                support_note?: string } | null;
  evidence: { text_available: boolean; sections_detected: string[] } | null;
  extractor: string | null;
  model: string | null;
  prompt_version: string | null;
  extracted_at: string | null;
}

export interface PoolDocumentImport {
  import_id: string;
  source: string;
  source_detail: Record<string, unknown> | null;
  original_filename: string | null;
  job_id: string | null;
  application_id: string | null;
  uploaded_by: string | null;
  outcome: string;
  imported_at: string | null;
  email?: GmailEmailView | null;
}

export interface PoolDocument {
  document_id: string;
  version_number: number | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  is_current: boolean;
  extraction_status: string;
  extraction_error: string | null;
  extraction_attempts: number;
  text_source: string | null;
  text_chars: number | null;
  file_metadata: { modified?: string; created?: string; pages?: number } | null;
  content_latest_month: number | null;
  content_has_present: boolean | null;
  first_imported_at: string | null;
  imports: PoolDocumentImport[];
  profiles: { profile_id: string; version: number; extractor: string; is_primary: boolean; status: string;
              model: string | null; prompt_version: string | null; created_at: string | null; is_current: boolean;
              comparison_only: boolean }[];
}

export interface PoolApplication {
  candidate_id: string;
  job_id: string;
  job_title: string;
  job_open: boolean;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  shortlist: boolean;
  shortlist_updated_at: string | null;
  added_via: string;
  added_at: string | null;
  assessment: { total_score: number; summary: string | null; assessed_at: string | null; model: string | null;
                scoring_version: string | null; is_stale: boolean; stale_reasons: StaleReason[];
                cv_version: number | null; profile_version: number | null; history_count: number } | null;
}

export interface PoolNote {
  note_id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  job_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PoolCandidateDetail {
  pool_candidate_id: string;
  status: string;
  name: string | null;
  primary_email: string | null;
  known_emails: string[];
  phone: string | null;
  current_title: string | null;
  current_employer: string | null;
  experience_months: { min: number | null; max: number | null };
  experience: { months_min: number | null; months_max: number | null; as_of: string | null;
                as_of_source: "file_modified" | "first_import" | "hr_confirmed" | null;
                present_confirmed_at: string | null; present_confirmed_by: string | null; has_present_role: boolean };
  warnings: ValidationFlag[];
  language_warning: boolean;
  merges: { merge_id: string; role: "kept" | "merged_away"; other_candidate_id: string | null; other_name: string | null;
            reason: string; automatic: boolean; by: string | null; created_at: string | null; undone_at: string | null;
            undone_by: string | null; moved: Record<string, number>; can_undo: boolean }[];
  extraction_status: string;
  review_flag_count: number;
  added_at: string | null;
  updated_at: string | null;
  current: { document_id: string | null; profile_id: string | null; selection: string | null;
             needs_review: boolean; review_reason: string | null };
  profile: PoolProfile | null;
  documents: PoolDocument[];
  applications: PoolApplication[];
  notes: PoolNote[];
  identity_reviews: { review_id: string; reason: string; evidence: Record<string, unknown> | null;
                      other_candidate_id: string; other_name: string | null; created_at: string | null }[];
}

// ---------------------------------------------------------------------------- Gmail import

export interface GmailEmailView {
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  forwarded_from_name: string | null;
  forwarded_from_email: string | null;
  received_at: string | null;
  text_excerpt?: string | null;
  text_truncated?: boolean;
}

export interface GmailConnection {
  connection_id: string;
  mailbox_email: string;
  status: "active" | "needs_reconnect" | "disconnected";
  is_owner: boolean;
  owner_name: string | null;
  granted_scopes: string[];
  read_only: boolean;
  unexpected_scopes: string[];
  connected_at: string | null;
  last_checked_at: string | null;
  last_refreshed_at: string | null;
  last_used_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  disconnected_at: string | null;
  revoke_result: string | null;
  shared_with: { user_id: string; name: string; email: string }[];
}

export interface GmailConnectionsResponse {
  configured: boolean;
  setup_issue: string | null;
  can_connect: boolean;
  can_import: boolean;
  connections: GmailConnection[];
}

export interface GmailVariants {
  variants: string[];
  suggested: string[];
  rejected: { variant: string; reason: string }[];
  source: "ai" | "local";
  model: string | null;
  edited: boolean;
}

export interface GmailAttachmentPreview {
  part_id: string;
  filename: string;
  size: number;
  mime_type: string;
  supported: boolean;
  reason: string | null;
  nested_in_email: boolean;
  import_status: "new" | "in_job" | "in_pool" | "unsupported";
  import_detail: string | null;
}

export interface GmailSearchResultItem {
  message_id: string;
  thread_id: string | null;
  subject: string;
  sender_name: string | null;
  sender_email: string | null;
  received_at: string | null;
  forwarded: boolean;
  forwarded_from_name: string | null;
  forwarded_from_email: string | null;
  text: string;
  text_truncated: boolean;
  match: { level: "strong" | "possible" | "weak"; rank: number; explanation: string; variant: string | null;
           broad_only: boolean };
  attachments: GmailAttachmentPreview[];
}

export interface GmailSearchResponse {
  search_id: string;
  mode: "narrow" | "broad";
  variants: string[];
  date_from: string | null;
  date_to: string | null;
  queries: string[];
  results: GmailSearchResultItem[];
  listed: number;
  hidden: number;
  totals: { listed: number; matched: number; hidden: number };
  estimated_total: number;
  incomplete: boolean;
  can_load_more: boolean;
  incomplete_reason: string | null;
}

export type GmailRunStatus = "queued" | "running" | "completed" | "completed_with_errors" | "cancelled" | "paused_reconnect";
export type GmailItemStatus = "pending" | "processing" | "imported" | "duplicate" | "rejected" | "failed" | "cancelled";

export interface GmailImportItem {
  item_id: string;
  message_id: string;
  part_id: string;
  filename: string | null;
  size: number | null;
  status: GmailItemStatus;
  reason: string | null;
  attempts: number;
  subject: string | null;
  sender: string | null;
  application_id: string | null;
  candidate_name: string | null;
  processing_status: ProcessingStatus | null;
  pool_candidate_id: string | null;
}

export interface GmailImportRun {
  run_id: string;
  job_id: string;
  status: GmailRunStatus;
  status_reason: string | null;
  mailbox_email: string;
  connection_id: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested: boolean;
  counts: Record<GmailItemStatus, number>;
  total: number;
  items?: GmailImportItem[];
}
