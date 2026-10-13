"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MapPin, Briefcase, Users, Play, Trash2, Edit, X, FolderOpen, Clock } from "lucide-react";
import { CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JobModal } from "@/components/JobModal";
import { jobsAPI, visnextAPI, configAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { Job } from "@/types";
import toast, { Toaster } from "react-hot-toast";

interface ExpandedJob {
  job_id: string;
}

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

function ErrorModal({ isOpen, onClose, title, message }: ErrorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#1a2a3a] border border-red-500/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-300 mb-4">{message}</p>
            <Button onClick={onClose} className="w-full">OK</Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isLoading }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-300 mb-4">{message}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={onConfirm} isLoading={isLoading} variant="danger" className="flex-1">Delete</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function JobCard({ 
  job, 
  isExpanded, 
  onToggle, 
  onEdit, 
  onDelete, 
  onOpen,
  onParseResumes,
  onToggleStatus
}: { 
  job: Job; 
  isExpanded: boolean; 
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onParseResumes: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <motion.div
        layout
        className={`
          bg-[#132F4C] rounded-xl transition-all duration-300 cursor-pointer
          ${isExpanded ? 'ring-2 ring-[#00C853]' : 'hover:ring-2 hover:ring-[#00C853]/50'}
        `}
        onClick={onToggle}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className={`w-3 h-3 rounded-full ${job.job_available !== false ? "bg-[#00C853]" : "bg-[#FF5252]"}`} />
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg">{job.title}</h3>
                <div className="flex items-center gap-3 text-sm text-[#B0BEC5] flex-wrap">
                  {job.location && (
                    <>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.location}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {job.job_type && (
                    <>
                      <span className="flex items-center gap-1">
                        <Briefcase size={14} />
                        {job.job_type}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {job.required_experience || "Experience not specified"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {job.candidate_count || 0} CV{job.candidate_count === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                job.job_available !== false 
                  ? "bg-[#00C853]/20 text-[#00C853]" 
                  : "bg-[#FF5252]/20 text-[#FF5252]"
              }`}>
                {job.job_available !== false ? "Open" : "Closed"}
              </span>
              
              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="p-2 rounded-lg hover:bg-[#1E3A5F] text-[#B0BEC5] transition-colors"
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-[#2A3F5E]">
                  {job.about_role && (
                    <div className="mb-4">
                      <h4 className="text-[#00C853] font-medium text-sm mb-2">Job Description</h4>
                      <p className="text-white text-sm whitespace-pre-line">{job.about_role}</p>
                    </div>
                  )}

                  {job.requirements && (
                    <div className="mb-4">
                      <h4 className="text-[#00C853] font-medium text-sm mb-2">Required Skills &amp; Qualifications</h4>
                      <p className="text-white text-sm whitespace-pre-line">{job.requirements}</p>
                    </div>
                  )}

                  {job.required_experience && (
                    <div className="mb-4">
                      <h4 className="text-[#00C853] font-medium text-sm mb-2">Required Experience</h4>
                      <p className="text-white text-sm whitespace-pre-line">{job.required_experience}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-3 pt-2 flex-wrap">
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                      <FolderOpen size={14} className="mr-1" />
                      Import CVs &amp; Ranking
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}>
                      {job.job_available !== false ? (
                        <>
                          <span className="mr-1">⏸</span>
                          Close Job
                        </>
                      ) : (
                        <>
                          <span className="mr-1">✓</span>
                          Reopen Job
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onParseResumes(); }}>
                      <Play size={14} className="mr-1" />
                      Process Pending CVs
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 hover:text-red-300">
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </motion.div>
    </motion.div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [deletingJob, setDeletingJob] = useState(false);
  const [visnextEnabled, setVisnextEnabled] = useState(false);

  useEffect(() => {
    fetchJobs();
    configAPI.get()
      .then((response) => setVisnextEnabled(Boolean(response.data?.features?.visnext_sync)))
      .catch(() => setVisnextEnabled(false));
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response?.data || []);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to fetch jobs";
      setErrorModal({ isOpen: true, title: "Error", message });
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchJobs = async () => {
    setIsFetching(true);
    try {
      const response = await visnextAPI.fetchJobs();
      const totalJobs = response?.data?.detail?.response?.total_jobs || 0;
      toast.success(`Synced ${totalJobs} jobs`);
      fetchJobs();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === "string" ? detail : detail?.error?.details || "Failed to sync";
      setErrorModal({ isOpen: true, title: "Sync Failed", message });
    } finally {
      setIsFetching(false);
    }
  };

  const handleParseResumes = async (jobId: string) => {
    try {
      const response = await jobsAPI.processPending(jobId);
      const queued = response.data.queued || 0;
      toast.success(queued ? `${queued} CV(s) queued for AI processing` : "No pending CVs to process");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start processing"));
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteModal.job) return;
    setDeletingJob(true);
    try {
      await jobsAPI.delete(deleteModal.job.job_id);
      toast.success("Job deleted successfully!");
      setDeleteModal({ isOpen: false, job: null });
      fetchJobs();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to delete job";
      toast.error(message);
    } finally {
      setDeletingJob(false);
    }
  };

  const handleToggleJobStatus = async (job: Job) => {
    try {
      const newStatus = job.job_available === false ? true : false;
      await jobsAPI.update(job.job_id, { job_available: newStatus });
      toast.success(`Job ${newStatus ? 'reopened' : 'closed'}`);
      fetchJobs();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to update job status";
      toast.error(message);
    }
  };

  const handleEditJob = (job: Job) => {
    setEditJob(job);
    setJobModalOpen(true);
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  const filteredJobs = Array.isArray(jobs) ? jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "open") return job.job_available !== false;
    if (filter === "closed") return job.job_available === false;
    return true;
  }) : [];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
      <JobModal
        isOpen={jobModalOpen}
        onClose={() => { setJobModalOpen(false); setEditJob(null); }}
        onSuccess={fetchJobs}
        editJob={editJob}
      />
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, job: null })}
        onConfirm={handleDeleteJob}
        title="Delete Job"
        message={`Are you sure you want to delete "${deleteModal.job?.title}"? Its applications, assessments and shortlist decisions are deleted. The candidates, their CVs and profiles stay in the Candidate Pool.`}
        isLoading={deletingJob}
      />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-[#B0BEC5]">Create job openings, import CVs and review AI-ranked candidates</p>
        </div>
        <div className="flex gap-3">
          {visnextEnabled && (
            <Button variant="outline" onClick={handleFetchJobs} isLoading={isFetching}>
              Sync from VisNext
            </Button>
          )}
          <Button onClick={() => setJobModalOpen(true)}>
            Create Job
          </Button>
        </div>
      </motion.div>

      <div className="flex gap-2">
        {(["all", "open", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? "bg-[#00C853] text-white"
                : "bg-[#132F4C] text-[#B0BEC5] hover:text-white"
            }`}
          >
            {f === "all" ? "All Jobs" : f === "open" ? "Open" : "Closed"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#132F4C] rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#B0BEC5] mb-4">
            {filter === "open" 
              ? "No open jobs found." 
              : filter === "closed" 
                ? "No closed jobs found." 
                : "No jobs found. Create a new job to get started."}
          </p>
          {filter !== "closed" && (
            <Button onClick={() => setJobModalOpen(true)}>
              Create Job
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              isExpanded={expandedJob === job.job_id}
              onToggle={() => toggleJobExpansion(job.job_id)}
              onEdit={() => handleEditJob(job)}
              onDelete={() => setDeleteModal({ isOpen: true, job })}
              onOpen={() => router.push(`/dashboard/jobs/${job.job_id}`)}
              onParseResumes={() => handleParseResumes(job.job_id)}
              onToggleStatus={() => handleToggleJobStatus(job)}
            />
          ))}
        </div>
      )}
    </div>
  );
}