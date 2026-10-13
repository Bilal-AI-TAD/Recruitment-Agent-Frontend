"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, Clock, User, Calendar, ChevronRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { interviewsDataAPI, candidatesAPI, jobsAPI, elevenlabsAPI } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";

interface CallData {
  id: string;
  candidate_id: string;
  job_id: string;
  interviewer_id: string;
  conversation_id: string;
  scheduled_time: string | null;
  status: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
}

interface CandidateInfo {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
}

interface TranscriptData {
  conversation_id: string;
  transcript: Array<{ role: string; message: string }>;
  analysis: {
    transcript_summary: string;
    success_evaluation: string;
    call_quality: string;
  };
}

export default function AICallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallData[]>([]);
  const [candidates, setCandidates] = useState<Record<string, CandidateInfo>>({});
  const [jobs, setJobs] = useState<Record<string, { title: string; company: string }>>({});
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed" | "in_progress">("all");
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [interviewsRes, jobsRes, candidatesRes] = await Promise.all([
        interviewsDataAPI.getAll(),
        jobsAPI.getAll(),
        candidatesAPI.getAll()
      ]);
      
      setCalls(interviewsRes.data || []);
      
      const jobsMap: Record<string, { title: string; company: string }> = {};
      (jobsRes.data || []).forEach((job: any) => {
        jobsMap[job.job_id] = { title: job.title, company: job.company };
      });
      setJobs(jobsMap);

      const candidatesMap: Record<string, CandidateInfo> = {};
      (candidatesRes.data?.data || []).forEach((cand: any) => {
        candidatesMap[cand.candidate_id] = {
          candidate_id: cand.candidate_id,
          first_name: cand.first_name,
          last_name: cand.last_name,
          email: cand.email,
          phone_number: cand.phone_number
        };
      });
      setCandidates(candidatesMap);
      
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to fetch data";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    if (filter === "all") return true;
    return call.status === filter;
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getJobInfo = (jobId: string) => {
    return jobs[jobId] || { title: "Unknown Job", company: "Unknown" };
  };

  const getCandidateInfo = (candidateId: string) => {
    return candidates[candidateId] || { first_name: "Unknown", last_name: "Candidate", email: "N/A" };
  };

  const handleCallClick = async (call: CallData) => {
    setActiveCall(call);
    setTranscript(null);
    if (call.conversation_id) {
      fetchTranscript(call.conversation_id);
    }
  };

  const fetchTranscript = async (conversationId: string) => {
    setLoadingTranscript(true);
    try {
      // Try direct conversation API first
      const response = await elevenlabsAPI.getConversation(conversationId);
      if (response.data?.data) {
        setTranscript({
          conversation_id: conversationId,
          transcript: response.data.data.transcript || [],
          analysis: {
            transcript_summary: response.data.data.transcript_summary || "",
            success_evaluation: "",
            call_quality: ""
          }
        });
        setLoadingTranscript(false);
        return;
      }
    } catch (error: any) {
      console.log("Direct conversation fetch failed, trying candidate latest conversation");
    }

    // Fallback: try to get from candidate's latest conversation
    if (activeCall?.candidate_id) {
      try {
        const latestRes = await elevenlabsAPI.getCandidateLatestConversation(activeCall.candidate_id);
        if (latestRes.data?.data) {
          setTranscript({
            conversation_id: latestRes.data.data.conversation_id || conversationId,
            transcript: latestRes.data.data.transcript || [],
            analysis: {
              transcript_summary: latestRes.data.data.transcript_summary || "",
              success_evaluation: "",
              call_quality: ""
            }
          });
          setLoadingTranscript(false);
          return;
        }
      } catch (e) {
        console.log("No latest conversation found");
      }
    }
    
    setTranscript(null);
    setLoadingTranscript(false);
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">AI Calls</h1>
          <p className="text-[#B0BEC5]">Monitor and manage AI-powered candidate calls</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </Button>
      </motion.div>

      <div className="flex gap-2">
        {(["all", "scheduled", "in_progress", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? "bg-[#00C853] text-white"
                : "bg-[#132F4C] text-[#B0BEC5] hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#132F4C] rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filteredCalls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone size={48} className="mx-auto mb-4 text-[#546E7A]" />
            <p className="text-[#B0BEC5]">No AI calls found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredCalls.map((call, index) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleCallClick(call)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      activeCall?.id === call.id
                        ? "bg-[#00C853]/20 border border-[#00C853]"
                        : "bg-[#132F4C] hover:bg-[#1E3A5F]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          call.status === "completed" ? "bg-[#00C853]/20 text-[#00C853]" :
                          call.status === "in_progress" ? "bg-[#FFB300]/20 text-[#FFB300]" :
                          "bg-[#2196F3]/20 text-[#2196F3]"
                        }`}>
                          <Phone size={18} />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{getCandidateInfo(call.candidate_id).first_name} {getCandidateInfo(call.candidate_id).last_name}</h4>
                          <p className="text-sm text-[#B0BEC5]">{getJobInfo(call.job_id).title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {call.scheduled_time && (
                          <span className="text-sm text-[#B0BEC5] flex items-center gap-1">
                            <Clock size={14} />
                            {formatTime(call.scheduled_time)}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs ${
                          call.status === "completed" ? "bg-[#00C853]/20 text-[#00C853]" :
                          call.status === "in_progress" ? "bg-[#FFB300]/20 text-[#FFB300]" :
                          "bg-[#2196F3]/20 text-[#2196F3]"
                        }`}>
                          {call.status || "scheduled"}
                        </span>
                        <ChevronRight size={18} className="text-[#546E7A]" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div>
            {activeCall ? (
              <Card>
                <CardHeader>
                  <CardTitle>Call Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center mb-4">
                      <User size={32} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{getCandidateInfo(activeCall.candidate_id).first_name} {getCandidateInfo(activeCall.candidate_id).last_name}</h3>
                    <p className="text-sm text-[#B0BEC5]">{getJobInfo(activeCall.job_id).title}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Email</span>
                      <span className="text-sm text-white">{getCandidateInfo(activeCall.candidate_id).email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Phone</span>
                      <span className="text-sm text-white">{getCandidateInfo(activeCall.candidate_id).phone_number || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Conversation ID</span>
                      <span className="text-sm text-white truncate max-w-[150px]">{activeCall.conversation_id || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Scheduled Time</span>
                      <span className="text-sm text-white">{formatTime(activeCall.scheduled_time)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Date</span>
                      <span className="text-sm text-white">{formatDate(activeCall.scheduled_time)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#132F4C] rounded-lg">
                      <span className="text-sm text-[#B0BEC5]">Status</span>
                      <span className={`text-sm ${
                        activeCall.status === "completed" ? "text-[#00C853]" :
                        activeCall.status === "in_progress" ? "text-[#FFB300]" :
                        "text-[#2196F3]"
                      }`}>
                        {activeCall.status || "scheduled"}
                      </span>
                    </div>
                  </div>

                  {/* Transcript & Summary Section */}
                  {activeCall.conversation_id && (
                    <div className="space-y-3">
                      {loadingTranscript ? (
                        <div className="text-center py-4">
                          <div className="animate-spin w-8 h-8 border-2 border-[#00C853] border-t-transparent rounded-full mx-auto"></div>
                          <p className="text-sm text-[#B0BEC5] mt-2">Loading transcript...</p>
                        </div>
                      ) : transcript ? (
                        <>
                          {/* Summary */}
                          {transcript.analysis?.transcript_summary && (
                            <div className="bg-[#00C853]/10 border border-[#00C853]/30 rounded-lg p-4">
                              <h4 className="text-[#00C853] font-semibold mb-2">Call Summary</h4>
                              <p className="text-white text-sm">{transcript.analysis.transcript_summary}</p>
                            </div>
                          )}
                          
                          {/* Additional Analysis */}
                          {transcript.analysis?.success_evaluation && (
                            <div className="bg-[#132F4C] rounded-lg p-4">
                              <h4 className="text-[#B0BEC5] font-semibold mb-2">Evaluation</h4>
                              <p className="text-white text-sm">{transcript.analysis.success_evaluation}</p>
                            </div>
                          )}
                          
                          {transcript.analysis?.call_quality && (
                            <div className="bg-[#132F4C] rounded-lg p-4">
                              <h4 className="text-[#B0BEC5] font-semibold mb-2">Call Quality</h4>
                              <p className="text-white text-sm">{transcript.analysis.call_quality}</p>
                            </div>
                          )}

                          {/* Transcript */}
                          {transcript.transcript && transcript.transcript.length > 0 && (
                            <div className="bg-[#132F4C] rounded-lg p-4 max-h-64 overflow-y-auto">
                              <h4 className="text-[#00C853] font-semibold mb-3">Transcript</h4>
                              <div className="space-y-2">
                                {transcript.transcript.map((msg, idx) => (
                                  <div key={idx} className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[85%] rounded-lg p-3 ${
                                      msg.role === 'agent' ? 'bg-[#1E3A5F]' : 'bg-[#00C853]/20'
                                    }`}>
                                      <p className="text-xs text-[#B0BEC5] mb-1 capitalize">{msg.role}</p>
                                      <p className="text-white text-sm">{msg.message}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-[#B0BEC5] text-sm">No transcript available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCall.status === "completed" && (
                    <div className="space-y-2 pt-2">
                      <Button className="w-full" onClick={() => router.push(`/dashboard/candidates/${activeCall.candidate_id}`)}>
                        <Calendar size={18} className="mr-2" />
                        View Candidate Details
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Phone size={18} className="mr-2" />
                        Call Again
                      </Button>
                    </div>
                  )}

                  {activeCall.status === "scheduled" && (
                    <Button className="w-full">
                      <Phone size={18} className="mr-2" />
                      Start Call
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Phone size={48} className="mx-auto mb-4 text-[#546E7A]" />
                  <p className="text-[#B0BEC5]">Select a call to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
