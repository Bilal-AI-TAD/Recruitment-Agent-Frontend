"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { jobsAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { Job } from "@/types";

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editJob?: Job | null;
}

const emptyForm = {
  title: "",
  about_role: "",
  requirements: "",
  required_experience: "",
  job_available: true,
  location: "",
  job_type: "Full-time",
  open_positions: 1,
};

const inputClass = "w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white";

export function JobModal({ isOpen, onClose, onSuccess, editJob }: JobModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (editJob) {
      setFormData({
        title: editJob.title || "",
        about_role: editJob.about_role || "",
        requirements: editJob.requirements || "",
        required_experience: editJob.required_experience || "",
        job_available: editJob.job_available !== false,
        location: editJob.location || "",
        job_type: editJob.job_type || "Full-time",
        open_positions: editJob.open_positions || 1,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [editJob, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const payload = {
      ...formData,
      location: formData.location.trim() || null,
      job_type: formData.job_type || null,
    };
    try {
      if (editJob) {
        await jobsAPI.update(editJob.job_id, payload);
        toast.success("Job updated successfully!");
      } else {
        await jobsAPI.create(payload);
        toast.success("Job created successfully!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save job"));
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
          className="relative bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>

          <h3 className="text-lg font-semibold text-white mb-4">
            {editJob ? "Edit Job" : "Create New Job"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Job Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Warehouse Operations Supervisor"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Job Description *</label>
              <textarea
                value={formData.about_role}
                onChange={(e) => setFormData({ ...formData, about_role: e.target.value })}
                placeholder="Describe the role and its main responsibilities..."
                rows={4}
                className={`${inputClass} resize-none`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Required Skills &amp; Qualifications *</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="e.g., WMS, inventory control, SAP; degree in supply chain or related field"
                rows={3}
                className={`${inputClass} resize-none`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Required Experience *</label>
              <input
                type="text"
                value={formData.required_experience}
                onChange={(e) => setFormData({ ...formData, required_experience: e.target.value })}
                placeholder="e.g., 5+ years in warehouse or logistics operations"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={formData.job_available ? "open" : "closed"}
                onChange={(e) => setFormData({ ...formData, job_available: e.target.value === "open" })}
                className={inputClass}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., City, Country"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Job Type</label>
                <select
                  value={formData.job_type}
                  onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Open Positions</label>
              <input
                type="number"
                value={formData.open_positions}
                onChange={(e) => setFormData({ ...formData, open_positions: parseInt(e.target.value) || 1 })}
                min={1}
                className={inputClass}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                {editJob ? "Update Job" : "Create Job"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
