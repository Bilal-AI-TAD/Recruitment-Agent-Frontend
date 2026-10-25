export interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  /** Explicit server-granted permissions, e.g. "pool.remove", "pool.merge". Enforced by the backend. */
  permissions?: string[];
  /** The user's organization (decided by the server; never chosen by the client). */
  organization?: { organization_id: string; name: string } | null;
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
  cost_usd: number | null;
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
  cost_status?: "calculated" | "reconstructed" | "unknown" | "uncertain" | "pending" | "not_applicable" | null;
  cost_reason?: string | null;
  reserved_usd?: number | null;
}

export type ProcessingStatus = "pending" | "queued" | "processing" | "completed" | "failed" | "duplicate"
  | "awaiting_cv" | "awaiting_analysis";

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
  /** Set when the CVs were imported but no paid AI analysis could be queued (permission, price or budget). */
  processing_blocked?: { code: string; message: string }[] | null;
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
  features: { other_ai_features_sync: boolean; outlook?: boolean; outlook_setup_issue?: string | null; mail_sending?: boolean };
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
  added_via?: "upload" | "pool" | "manual" | "gmail" | "outlook" | "headhunting";
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
  /** Application e-mail of a mailbox import (Outlook, or Gmail before it was removed). The sender may be an agency or
   * a colleague, not the candidate. (Key name kept from the Gmail integration.) */
  gmail?: MailEmailView | null;
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
  cv_required?: boolean;
  headhunting?: { provenance: ExternalProfile[]; open_identity_reviews: number; analysis_requests: AnalysisRequestInfo[];
                  cv_name_mismatch?: { cv_name: string; profile_name: string; message: string } | null;
                  outreach?: { contacted_at: string | null; status: string | null } };
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
  email?: MailEmailView | null;
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
  kind?: "note" | "contact";
  created_at: string | null;
  updated_at: string | null;
}

/** Provenance of a pool person found by headhunting (public profile; not a CV). */
export interface ExternalProfile {
  link_id: string;
  source: string;
  canonical_url: string;
  profile_type: string | null;
  display_name: string | null;
  headline: string | null;
  added_at: string | null;
  origin: { job_id?: string; run_id?: string; prospect_id?: string; run_mode?: string | null; run_finished_at?: string | null };
  evidence: {
    label?: string;
    captured_at?: string;
    search_sources?: { title: string | null; snippet: string | null; url: string | null; engine: string | null; retrieved_at: string | null; queries?: number }[];
    fetched_sources?: { url: string; source_kind: string; outcome: string; retrieved_at: string | null; sha256: string | null;
                        excerpts: { label: string; text: string }[] }[];
    requirements?: { requirement: string; status: HHRequirementStatus; basis: string | null; activity: string | null;
                     excerpts: { source_kind: string; text: string }[] }[];
    assessment?: { method: string | null; prompt_version: string | null; model: string | null };
  };
}

export interface AnalysisRequestInfo {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed" | "needs_identity";
  reserved_usd: number;
  spent_usd: number | null;
  llm_calls: number;
  error: string | null;
  created_at: string | null;
  finished_at: string | null;
  cost?: { calls: number; incurred_usd: number; unknown_calls: number; uncertain_reserved_usd: number;
           unknown_reasons: string[]; reserved_by_calls_usd: number; committed_usd: number };
}

export interface AnalysisState {
  candidate_id: string;
  added_via: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  cv_required: boolean;
  blockers: { code: string; message: string }[];
  max_cost_usd: number;
  requests: AnalysisRequestInfo[];
}

export interface RecruitmentStatus {
  status: "new" | "already_added" | "url_match" | "possible_matches";
  pool_candidate: { pool_candidate_id: string; display_name: string | null; has_cv: boolean } | null;
  application: { candidate_id: string; processing_status: ProcessingStatus } | null;
  url_matches: { pool_candidate_id: string; display_name: string | null; has_cv: boolean; name_compatible: boolean | null }[];
  name_matches: { pool_candidate_id: string; display_name: string | null; has_cv: boolean }[];
  can_add: boolean;
  job_open: boolean;
  retention_note: string;
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
  external_profiles?: ExternalProfile[];
}

// ---------------------------------------------------------------------------- Mailbox import

export interface MailEmailView {
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  forwarded_from_name: string | null;
  forwarded_from_email: string | null;
  received_at: string | null;
  text_excerpt?: string | null;
  text_truncated?: boolean;
}

export interface MailConnection {
  connection_id: string;
  provider?: "gmail" | "outlook";
  auth_mode?: "delegated" | "app_only" | null;
  mailbox_email: string;
  status: "active" | "needs_reconnect" | "disconnected";
  is_owner: boolean;
  owner_name: string | null;
  granted_scopes: string[];
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

export interface MailConnectionsResponse {
  outlook_configured?: boolean;
  outlook_setup_issue?: string | null;
  can_connect: boolean;
  can_import: boolean;
  connections: MailConnection[];
}

export interface MailVariants {
  variants: string[];
  suggested: string[];
  rejected: { variant: string; reason: string }[];
  source: "ai" | "local";
  model: string | null;
  edited: boolean;
  ai_refused?: boolean;
}

/** One sample subject tested against a job's phrases (no mailbox, no AI). */
export interface MailPhrasePreview {
  subject: string;
  matches: boolean;
  level: "strong" | "possible" | "weak" | "none";
  phrase: string | null;
  explanation: string;
  other_jobs: { job_id: string; title: string }[];
}

/** An e-mail whose subject names the job but that cannot be imported - with the reason. */
export interface MailSkippedMessage {
  message_id: string;
  subject: string;
  received_at: string | null;
  sender_domain: string | null;
  reason: string;
  detail: string | null;
}

export interface MailSearchSummary {
  listed: number;
  subject_matched: number;
  importable: number;
  already_imported: number;
  no_eligible_cv: number;
  not_matching: number;
  own_mail: number;
  outside_period: number;
  empty_reason: "no_messages" | "none_matched" | "all_imported" | "no_eligible_cv" | "nothing_importable" | "incomplete" | null;
  empty_text: string | null;
}

export interface MailAttachmentPreview {
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

export interface MailSearchResultItem {
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
  attachments: MailAttachmentPreview[];
  /** Other open jobs this e-mail's subject also names - HR confirms the job before importing. */
  other_jobs?: { job_id: string; title: string }[];
}

export interface MailSearchResponse {
  search_id: string;
  complete?: boolean;
  coverage?: { windows_total: number; windows_done: number; period_from: string | null; period_to: string | null;
               searched_from: string | null; searched_to: string | null };
  hidden_reasons?: Record<string, number>;
  skipped?: MailSkippedMessage[];
  summary?: MailSearchSummary;
  pending_preview?: number;
  provider?: "gmail" | "outlook";
  job_id?: string | null;
  mode: "narrow" | "broad";
  variants: string[];
  date_from: string | null;
  date_to: string | null;
  queries: string[];
  results: MailSearchResultItem[];
  listed: number;
  hidden: number;
  totals: { listed: number; matched: number; hidden: number };
  estimated_total: number;
  incomplete: boolean;
  can_load_more: boolean;
  incomplete_reason: string | null;
}

export type MailRunStatus = "queued" | "running" | "completed" | "completed_with_errors" | "cancelled" | "paused_reconnect";
export type MailItemStatus = "pending" | "processing" | "imported" | "duplicate" | "rejected" | "failed" | "cancelled";

export interface MailImportItem {
  item_id: string;
  message_id: string;
  part_id: string;
  filename: string | null;
  size: number | null;
  status: MailItemStatus;
  reason: string | null;
  attempts: number;
  subject: string | null;
  sender: string | null;
  application_id: string | null;
  candidate_name: string | null;
  processing_status: ProcessingStatus | null;
  pool_candidate_id: string | null;
}

export interface MailImportRun {
  run_id: string;
  job_id: string | null;
  provider?: "gmail" | "outlook";
  status: MailRunStatus;
  status_reason: string | null;
  mailbox_email: string;
  connection_id: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested: boolean;
  counts: Record<MailItemStatus, number>;
  total: number;
  items?: MailImportItem[];
}

// ---------------------------------------------------------------- Headhunting (internal slice)

export type HHRequirementStatus = "supported" | "indicated" | "unknown" | "contradicted";
export type HHReviewStatus = "new" | "shortlist_for_review" | "needs_more_info" | "not_relevant";

export interface HHDisclaimers {
  supported: string;
  indicated: string;
  evaluation: string;
  scope: string;
}

export interface HHConfig {
  enabled: boolean;
  modes: ("rules-diagnostic" | "ai")[];
  can_review: boolean;
  limits: Record<string, number>;
  engines: string[];
  ai: {
    model: string;
    unavailable_reason: string | null;
    max_cost_usd_per_run: number | null;
    daily_budget_usd: number | null;
    daily_remaining_usd: number | null;
  };
  retention: {
    days: number;
    max_extension_days: number;
    max_total_days: number;
    warning_days: number;
    unavailable_reason: string | null;
    can_manage: boolean;
    extend_reasons: string[];
    delete_reasons: string[];
    forced_suppression_reasons: string[];
  };
  disclaimers: HHDisclaimers;
}

export interface HHRun {
  run_id: string;
  job_id: string;
  mode: "rules-diagnostic" | "ai";
  cost_class?: "free" | "paid_ai";
  status: string;
  stage: string;
  status_reason: string | null;
  limits: Record<string, number>;
  usage: Record<string, number>;
  counts: Record<string, unknown>;
  items: Record<string, Record<string, number>>;
  failed_items?: { kind: string; key: string; attempts: number; reason: string }[];
  filters: { location: string } & Record<string, unknown>;
  model: string | null;
  cancel_requested: boolean;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  disclaimers: HHDisclaimers;
}

export interface HHClaim {
  value: string;
  kind?: string;
  basis?: string;
  quote?: string;
  source_kind?: string;
}

export interface HHProspect {
  prospect_id: string;
  canonical_url: string;
  display_name: string;
  handle?: string | null;
  headline: string | null;
  profile_type: string;
  screened_by: string;
  research_note: string | null;
  source_kinds: string[];
  assessment_method: string | null;
  requirements_met: number;
  status_counts: Record<HHRequirementStatus, number>;
  requirements: { requirement: string; status: HHRequirementStatus; activity: string | null }[];
  deterministic: {
    current_location: HHClaim | null;
    availability: HHClaim | null;
    relocation_preference: HHClaim | null;
    location_hints: string[];
    location_status: string;
    experience_claims: { text: string; source_kind: string }[];
    experience_status: string;
  };
  ai: null | {
    current_location: { value: string | null };
    availability: { value: string | null };
    relocation_preference: { value: string | null };
    experience_statement: { value: string | null };
  };
  disagreements: string[];
  review: { status: HHReviewStatus; note: string | null; reviewed_at: string | null };
  retention: HHRetentionBrief;
  in_pool?: string | null;
}

export interface HHRetentionBrief {
  expires_at: string | null;
  days_left: number | null;
  expiring_soon: boolean;
  extended: boolean;
}

export interface HHRetentionInfo {
  expires_at: string | null;
  days_left: number | null;
  first_discovered_at: string | null;
  cap_at: string | null;
  can_extend_until: string | null;
  extensions: number;
  extension_note: string | null;
  history: { action: string; reason_code: string | null; old_expires_at: string | null; new_expires_at: string | null; at: string | null }[];
  can_manage: boolean;
  review_status_extends_retention: boolean;
  presence?: { runs: number; jobs: number; active_runs: number };
  possible_same_person?: { prospect_id: string; run_id: string; job_id: string; display_name: string; canonical_url: string; match: string }[];
}

export interface HHAssessedRequirement {
  requirement: string;
  status: HHRequirementStatus;
  evidence_ids: string[];
  basis: string | null;
  attribution: string | null;
  activity: string | null;
  scope_note: string | null;
  downgrades: string[];
  adjustments?: string[];
}

export interface HHProspectDetail extends HHProspect {
  search_sources: { result_id: string; url: string; engine: string; query_text: string; title: string; snippet: string; retrieved_at: string }[];
  fetched_sources: { source_id: string; purpose: string; source_kind: string; url: string; final_url: string | null; outcome: string;
                     retrieved_at: string | null; sha256: string | null; identity_link: string; excerpts: { label: string; text: string; value?: string }[] }[];
  assessment: null | {
    method: string;
    requirements: HHAssessedRequirement[];
    evidence_items: { evidence_id: string; source_kind: string; url: string | null; excerpt: string }[];
    observations: { quote: string; evidence_id: string; note: string | null; strength: string }[];
    downgrades?: ({ field?: string; moved_to?: string; value?: string; expanded_from?: string } | string)[];
    dropped_claims?: number;
    observations_dropped?: Record<string, number>;
  };
  assessment_meta: { method: string; prompt_version: string | null; model: string | null } | null;
  disclaimers: HHDisclaimers;
}

/** Outlook mailbox (Microsoft Graph) and the approval outbox. */
export interface MailSendingStatus {
  enabled: boolean;
  issue: string | null;
  connected: boolean;
  mailbox: string | null;
  test_allowlist: boolean;
}

export interface OutlookStatus {
  configured: boolean;
  setup_issue: string | null;
  auth_mode: "delegated" | "app_only";
  mailbox: string | null;
  mailbox_type: "user" | "shared";
  can_connect: boolean;
  active_connection_id: string | null;
  sending: MailSendingStatus;
  reply_tracking: { last_synced_at: string | null; last_error: string | null } | null;
  outbox: Record<string, number> | null;
}

export type OutboxStatus = "awaiting_approval" | "approved" | "draft_created" | "send_requested" | "submitted"
  | "confirmed" | "uncertain" | "manual_review" | "bounced" | "failed" | "cancelled";

export interface OutboxMessage {
  outbox_id: string;
  kind: "candidate_message" | "headhunting_outreach" | "account_invitation" | "live_check";
  footer?: string | null;
  template: string;
  subject: string;
  body: string | null;
  recipients: string[];
  content_hash: string;
  status: OutboxStatus;
  status_label: string;
  status_detail: string | null;
  candidate_id: string | null;
  job_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  self_approved: boolean;
  created_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  attempts: number;
  can_edit: boolean;
  can_approve: boolean;
  can_cancel: boolean;
  can_resolve: boolean;
  /** The company mailbox it is sent from (null when none is connected or configured). */
  from?: string | null;
  attachments?: { name: string }[];
  /** [[placeholders]] still in the text; approval is refused while any remain. */
  open_placeholders?: string[];
  events?:{ event: string; actor: string | null; from: string | null; to: string | null; at: string | null }[];
}

export interface InboundReply {
  inbound_id: string;
  outbox_id: string;
  is_bounce: boolean;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  received_at: string | null;
  text_excerpt: string | null;
  has_attachments: boolean;
  correlated_by: "conversation" | "in_reply_to" | "references";
  opt_out?: boolean;
}

export interface CandidateThread {
  recipient: string | null;
  outreach?: boolean;
  suppressed?: boolean;
  can_compose: boolean;
  compose_blocked_reason: string | null;
  sending: MailSendingStatus;
  messages: OutboxMessage[];
  replies: InboundReply[];
}

// ------------------------------------------------ AI providers

/** A model the provider offers; `priced` = a price is established today, so the AI boundary will run it. */
export interface AiModelOption {
  id: string;
  priced: boolean;
  price: { input: number; cached_input: number | null; output: number; version: string | null;
           max_input_tokens: number | null } | null;
}

export interface AiProvider {
  provider: string;
  label: string;
  supported: boolean;
  key_source: "dashboard" | "env" | null;
  key_last4: string | null;
  env_key_name: string;
  default_model: string;
  models: AiModelOption[];
  last_test: { at: string; model: string | null; ok: boolean | null; message: string | null } | null;
}

export interface AiProvidersResponse {
  selection: { provider: string; model: string; source: "dashboard" | "env"; key_source: "dashboard" | "env" | null;
               usable: boolean; issue: string | null };
  applies_to: string[];
  refusal_fallbacks: string;
  providers: AiProvider[];
  can_manage: boolean;
  can_test: boolean;
  notice?: string;
}

export interface AiLiveModels {
  provider: string;
  models: AiModelOption[];
  priced_not_listed: string[];
}

export interface AiTestResult {
  provider: string;
  model: string;
  ok: boolean;
  reply: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
  error_code: string | null;
  message: string | null;
}
