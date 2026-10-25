"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Phone, Mail, Upload, X, AlertCircle, Trash2, Edit, User, Plus, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CVImport } from "@/components/CVImport";
import { ScoreBadge, StatusBadge } from "@/components/CandidateStatus";
import { jobsAPI, candidatesAPI, otherAIFeaturesAPI, configAPI } from "@/lib/api";
import { ProcessingStatus } from "@/types";
import { Job, Candidate } from "@/types";
import toast, { Toaster } from "react-hot-toast";

interface CandidateData {
  candidate_id: string;
  job_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  resume_filename?: string | null;
  processing_status: ProcessingStatus;
  total_score?: number | null;
  phone_number?: string;
  shortlist: boolean;
  created_at?: string;
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

interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobs: Job[];
  editCandidate?: CandidateData | null;
}

function CandidateModal({ isOpen, onClose, onSuccess, jobs, editCandidate }: CandidateModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    job_id: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (editCandidate) {
      setFormData({
        first_name: editCandidate.first_name || "",
        last_name: editCandidate.last_name || "",
        email: editCandidate.email || "",
        phone_number: editCandidate.phone_number || "",
        job_id: editCandidate.job_id || "",
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        job_id: jobs[0]?.job_id || "",
      });
    }
  }, [editCandidate, isOpen, jobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editCandidate) {
        await candidatesAPI.update(editCandidate.candidate_id, formData);
        toast.success("Candidate updated successfully!");
      } else {
        await candidatesAPI.create(formData);
        toast.success("Candidate added successfully!");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === "string" ? detail : detail?.error?.details || "Failed to save candidate";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <X size={20} />
          </button>

          <h3 className="text-lg font-semibold text-white mb-4">
            {editCandidate ? "Edit Candidate" : "Add New Candidate"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                  className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Job *</label>
              <select
                value={formData.job_id}
                onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
                required
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.job_id} value={job.job_id}>
                    {job.title} - {job.company || job.location}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                {editCandidate ? "Update" : "Add Candidate"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ImportModal({ isOpen, onClose, jobs, onImported }: { isOpen: boolean; onClose: () => void; jobs: Job[]; onImported: () => void }) {
  const openJobs = jobs.filter((job) => job.job_available !== false);
  const [jobId, setJobId] = useState("");

  useEffect(() => {
    if (isOpen) setJobId((current) => current || openJobs[0]?.job_id || "");
  }, [isOpen, openJobs]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="relative bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
          <h3 className="text-lg font-semibold text-white mb-4">Import CVs</h3>
          {openJobs.length === 0 ? (
            <p className="text-[#B0BEC5] text-sm">Create or reopen a job before importing CVs.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Job *</label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
                >
                  {openJobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>{job.title}</option>
                  ))}
                </select>
              </div>
              {jobId && <CVImport key={jobId} jobId={jobId} onImported={onImported} />}
            </div>
          )}
        </motion.div>
      </div>
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

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<CandidateData | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; candidate: CandidateData | null }>({ isOpen: false, candidate: null });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: "", message: "" });
  const [syncingOtherAIFeatures, setSyncingOtherAIFeatures] = useState(false);
  const [otherAIFeaturesEnabled, setOtherAIFeaturesEnabled] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  useEffect(() => {
    fetchJobs();
    configAPI.get()
      .then((response) => setOtherAIFeaturesEnabled(Boolean(response.data?.features?.other_ai_features_sync)))
      .catch(() => setOtherAIFeaturesEnabled(false));
  }, []);

  useEffect(() => {
    if (selectedJob || jobs.length > 0) {
      fetchCandidates();
    }
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedJob(response.data[0].job_id);
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to fetch jobs";
      setErrorModal({ isOpen: true, title: "Error", message });
    }
  };

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const response = await candidatesAPI.getAll(selectedJob || undefined, searchQuery || undefined);
      setCandidates(response.data.data || []);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to fetch candidates";
      toast.error(message);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncFromOtherAIFeatures = async () => {
    setSyncingOtherAIFeatures(true);
    try {
      await otherAIFeaturesAPI.fetchJobs();
      toast.success("Data synced from Other_AI_features");
      fetchJobs();
      fetchCandidates();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to sync from Other_AI_features";
      setErrorModal({ isOpen: true, title: "Sync Failed", message });
    } finally {
      setSyncingOtherAIFeatures(false);
    }
  };

  const handleShortlist = async (candidateId: string) => {
    try {
      await candidatesAPI.toggleShortlist(candidateId);
      toast.success("Shortlist status updated");
      fetchCandidates();
    } catch (error: any) {
      toast.error("Failed to update shortlist");
    }
  };

  const handleDeleteCandidate = async () => {
    if (!deleteModal.candidate) return;
    setDeletingCandidate(true);
    try {
      await candidatesAPI.delete(deleteModal.candidate.candidate_id);
      toast.success("Candidate deleted!");
      setDeleteModal({ isOpen: false, candidate: null });
      fetchCandidates();
    } catch (error: any) {
      toast.error("Failed to delete candidate");
    } finally {
      setDeletingCandidate(false);
    }
  };

  const handleEditCandidate = (candidate: CandidateData) => {
    setEditCandidate(candidate);
    setCandidateModalOpen(true);
  };

  const filteredCandidates = candidates.filter((c) =>
    `${c.name || ""} ${c.email || ""} ${c.resume_filename || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
      <CandidateModal
        isOpen={candidateModalOpen}
        onClose={() => { setCandidateModalOpen(false); setEditCandidate(null); }}
        onSuccess={fetchCandidates}
        jobs={jobs}
        editCandidate={editCandidate}
      />
      <ImportModal
        isOpen={resumeModalOpen}
        onClose={() => setResumeModalOpen(false)}
        jobs={jobs}
        onImported={fetchCandidates}
      />
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, candidate: null })}
        onConfirm={handleDeleteCandidate}
        title="Delete Candidate"
        message={`Are you sure you want to delete "${deleteModal.candidate?.name}"? Their stored CV file will also be deleted.`}
        isLoading={deletingCandidate}
      />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Candidates</h1>
          <p className="text-[#B0BEC5]">Candidates imported from CVs, per job</p>
        </div>
        <div className="flex gap-3">
          {otherAIFeaturesEnabled && (
            <Button variant="outline" onClick={handleSyncFromOtherAIFeatures} isLoading={syncingOtherAIFeatures}>
              <Upload size={16} className="mr-2" />
              Sync from Other_AI_features
            </Button>
          )}
          <Button variant="outline" onClick={() => setResumeModalOpen(true)}>
            <Upload size={16} className="mr-2" />
            Import CVs
          </Button>
          <Button onClick={() => setCandidateModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Add Candidate
          </Button>
        </div>
      </motion.div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#546E7A]" size={18} />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white placeholder-[#546E7A]"
          />
        </div>
        
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white"
        >
          {jobs.map((job) => (
            <option key={job.job_id} value={job.job_id}>
              {job.title}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#132F4C] rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[#B0BEC5] mb-4">No candidates found</p>
            <Button variant="outline" onClick={() => setCandidateModalOpen(true)}>
              <Plus size={16} className="mr-2" />
              Add Candidate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCandidates.map((candidate, index) => (
            <motion.div
              key={candidate.candidate_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card hover className="group cursor-pointer" onClick={() => router.push(`/dashboard/candidates/${candidate.candidate_id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center text-white font-semibold">
                        {candidate.name?.[0]?.toUpperCase() || "C"}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                          {candidate.name}
                          <StatusBadge status={candidate.processing_status} />
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-[#B0BEC5] flex-wrap">
                          {candidate.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={14} />
                              {candidate.email}
                            </span>
                          )}
                          {candidate.resume_filename && candidate.resume_filename !== candidate.name && (
                            <span className="flex items-center gap-1">
                              <FileText size={14} />
                              {candidate.resume_filename}
                            </span>
                          )}
                          {candidate.phone_number && (
                            <span className="flex items-center gap-1">
                              <Phone size={14} />
                              {candidate.phone_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      <ScoreBadge score={candidate.total_score} />
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        candidate.shortlist 
                          ? "bg-[#00C853]/20 text-[#00C853]" 
                          : "bg-[#132F4C] text-[#B0BEC5]"
                      }`}>
                        {candidate.shortlist ? "Shortlisted" : "Not Shortlisted"}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={candidate.shortlist ? "primary" : "outline"}
                          onClick={() => handleShortlist(candidate.candidate_id)}
                        >
                          <Star size={14} className={candidate.shortlist ? "fill-current" : ""} />
                        </Button>
                        <button 
                          onClick={() => handleEditCandidate(candidate)}
                          className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-white transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, candidate })}
                          className="p-2 rounded-lg hover:bg-[#FF5252]/20 text-[#B0BEC5] hover:text-[#FF5252] transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
