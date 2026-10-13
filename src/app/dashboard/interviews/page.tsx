"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight, Video, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { interviewsDataAPI, jobsAPI } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";

interface InterviewData {
  id: string;
  candidate_id: string;
  job_id: string;
  interviewer_id: string;
  scheduled_time: string | null;
  status: string;
}

interface JobInfo {
  job_id: string;
  title: string;
  company: string;
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [interviewsRes, jobsRes] = await Promise.all([
        interviewsDataAPI.getAll(),
        jobsAPI.getAll()
      ]);
      
      setInterviews(interviewsRes.data || []);
      
      const jobsMap: Record<string, JobInfo> = {};
      (jobsRes.data || []).forEach((job: JobInfo) => {
        jobsMap[job.job_id] = job;
      });
      setJobs(jobsMap);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : "Failed to fetch data";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const getJobInfo = (jobId: string) => {
    return jobs[jobId] || { title: "Unknown Job", company: "Unknown" };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = getDaysInMonth(currentDate);
  const today = new Date();
  const todayDate = today.getDate();
  const isCurrentMonth = today.getMonth() === currentDate.getMonth() && 
                         today.getFullYear() === currentDate.getFullYear();

  const getInterviewsForDate = (day: number) => {
    if (!day) return [];
    return interviews.filter((interview) => {
      if (!interview.scheduled_time) return false;
      const interviewDate = new Date(interview.scheduled_time);
      return interviewDate.getDate() === day &&
             interviewDate.getMonth() === currentDate.getMonth() &&
             interviewDate.getFullYear() === currentDate.getFullYear();
    });
  };

  const todayInterviews = interviews.filter((interview) => {
    if (!interview.scheduled_time) return false;
    const todayStr = today.toISOString().split("T")[0];
    return interview.scheduled_time.startsWith(todayStr);
  });

  const selectedDateInterviews = selectedDate ? getInterviewsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Interviews</h1>
          <p className="text-[#B0BEC5]">Manage and schedule interviews</p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Schedule Interview
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</CardTitle>
              <div className="flex gap-2">
                <button 
                  onClick={goToToday}
                  className="px-3 py-1 text-sm rounded-lg border border-[#00C853] text-[#00C853] hover:bg-[#00C853]/10 transition-colors"
                >
                  Today
                </button>
                <button 
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm text-[#B0BEC5] py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {daysInMonth.map((day, index) => {
                  const dayInterviews = day ? getInterviewsForDate(day) : [];
                  const hasInterview = dayInterviews.length > 0;
                  const isSelected = selectedDate === day;
                  const isToday = isCurrentMonth && day === todayDate;

                  return (
                    <button
                      key={index}
                      disabled={!day}
                      onClick={() => day && setSelectedDate(day)}
                      className={`relative p-2 rounded-lg text-center transition-all ${
                        !day ? "invisible" :
                        isSelected
                          ? "bg-[#00C853] text-white"
                          : isToday
                          ? "border border-[#00C853] text-[#00C853]"
                          : "hover:bg-[#132F4C] text-white"
                      }`}
                    >
                      <span className="text-sm">{day}</span>
                      {hasInterview && (
                        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          isSelected ? "bg-white" : "bg-[#00C853]"
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate ? `${monthNames[currentDate.getMonth()]} ${selectedDate}` : "Today's Schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(selectedDate ? selectedDateInterviews : todayInterviews).length === 0 ? (
                <p className="text-center text-[#B0BEC5] py-4">No interviews scheduled</p>
              ) : (
                (selectedDate ? selectedDateInterviews : todayInterviews).map((interview, index) => (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg bg-[#132F4C] hover:bg-[#1E3A5F] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-white">Candidate</span>
                        <div className="flex items-center gap-1 text-xs text-[#B0BEC5]">
                          <Briefcase size={12} />
                          {getJobInfo(interview.job_id).title}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        interview.status === "completed" ? "bg-[#00C853]/20 text-[#00C853]" :
                        interview.status === "in_progress" ? "bg-[#FFB300]/20 text-[#FFB300]" :
                        "bg-[#2196F3]/20 text-[#2196F3]"
                      }`}>
                        {interview.status || "scheduled"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#B0BEC5]">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {interview.scheduled_time ? formatDate(interview.scheduled_time) : "TBD"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {interview.scheduled_time ? formatTime(interview.scheduled_time) : "TBD"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Video size={14} className="mr-1" />
                        Join
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
