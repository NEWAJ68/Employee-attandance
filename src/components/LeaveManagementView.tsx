import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  History, 
  User, 
  FileText, 
  Check, 
  X, 
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  Briefcase,
  ArrowLeft
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings, LeaveRequest } from '../types';

interface LeaveManagementViewProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  onSubmitLeaveRequest: (req: Omit<LeaveRequest, 'id' | 'submittedAt'>) => void;
  onDecideLeaveRequest: (id: string, status: 'Approved' | 'Rejected') => void;
  isAdminLoggedIn: boolean;
  settings: Settings;
  loggedInEmployee?: Employee | null;
  onNavigateToView?: (view: string) => void;
}

export default function LeaveManagementView({
  employees,
  attendance,
  leaveRequests,
  onSubmitLeaveRequest,
  onDecideLeaveRequest,
  isAdminLoggedIn,
  settings,
  loggedInEmployee,
  onNavigateToView,
}: LeaveManagementViewProps) {
  // Employee Workspace States
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [leaveType, setLeaveType] = useState<'Sick' | 'Vacation' | 'Personal' | 'Other'>('Vacation');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveNotes, setLeaveNotes] = useState('');
  const [employeeFilterId, setEmployeeFilterId] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (loggedInEmployee) {
      setSelectedEmpId(loggedInEmployee.id);
      setEmployeeFilterId(loggedInEmployee.id);
    }
  }, [loggedInEmployee]);

  // Admin Workspace States
  const [selectedRequestForContext, setSelectedRequestForContext] = useState<LeaveRequest | null>(() => {
    // default to first Pending request if one exists, else first request
    const pending = leaveRequests.find(r => r.status === 'Pending');
    return pending || (leaveRequests.length > 0 ? leaveRequests[0] : null);
  });
  const [adminFilter, setAdminFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  // Active employees for dropdown
  const activeEmployees = employees.filter(emp => emp.status === 'Active');

  // Handle Request Submission
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setSubmissionStatus('error');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setSubmissionStatus('error');
      return;
    }

    const empName = employees.find(emp => emp.id === selectedEmpId)?.name || '';

    onSubmitLeaveRequest({
      employeeId: selectedEmpId,
      employeeName: empName,
      leaveType,
      startDate,
      endDate,
      status: 'Pending',
      notes: leaveNotes
    });

    setLeaveNotes('');
    setSubmissionStatus('success');
    setEmployeeFilterId(selectedEmpId); // Auto view my requests list
    setTimeout(() => setSubmissionStatus('idle'), 5000);
  };

  // Find requests depending on selected employee filter
  const filteredEmployeeRequests = leaveRequests.filter(req => {
    if (!employeeFilterId) return false;
    return req.employeeId === employeeFilterId;
  }).sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));

  // Find requests filtered for Admin review
  const adminFilteredRequests = leaveRequests.filter(req => {
    if (adminFilter === 'all') return true;
    return req.status === adminFilter;
  }).sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));

  // Context-aware computations for selected Employee's attendance history
  const getSelectedEmployeeStats = (empId: string) => {
    const records = attendance.filter(rec => rec.employeeId === empId);
    const totalDays = records.length;
    const presents = records.filter(rec => rec.entryTime && !rec.status.includes('Absent')).length;
    const lates = records.filter(rec => rec.status.includes('Late Entry')).length;
    const earlyExits = records.filter(rec => rec.status.includes('Early Exit')).length;
    const totalHoursSecured = records.reduce((sum, rec) => sum + (rec.totalHours || 0), 0);
    const avgHours = presents > 0 ? (totalHoursSecured / presents).toFixed(1) : '0.0';
    const onLeavesCount = records.filter(rec => rec.status.includes('On Leave')).length;

    // Get active employee details
    const detail = employees.find(emp => emp.id === empId);

    return {
      totalDays,
      presents,
      lates,
      earlyExits,
      avgHours,
      onLeavesCount,
      department: detail?.department || 'Unknown',
      joinedDate: detail?.joinedDate || 'Unknown',
      status: detail?.status || 'Inactive',
      hourlyRate: detail?.hourlyRate || 0,
      recentRecords: records.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5) // Last 5 days of history
    };
  };

  const contextEmployeeStats = selectedRequestForContext ? getSelectedEmployeeStats(selectedRequestForContext.employeeId) : null;

  return (
    <div className="space-y-8 animate-fadeIn font-sans" id="leave-management-container">
      {/* Page Back Link / Navigation Tabs */}
      {onNavigateToView && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-150/75 shadow-3xs select-none">
          <button 
            type="button"
            id="btn-back-to-terminal-leaves"
            onClick={() => onNavigateToView('terminal')}
            className="inline-flex items-center space-x-2 text-indigo-700 hover:text-indigo-900 bg-indigo-50/70 hover:bg-indigo-50 py-2 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 text-indigo-650 animate-pulse" />
            <span>Go Back to Punch Card / Terminal</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Quick Switch:</span>
            <button
              onClick={() => onNavigateToView('terminal')}
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/95 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Punch Card
            </button>
            <button
              onClick={() => onNavigateToView('my-attendance')}
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/95 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Attendance Logs
            </button>
          </div>
        </div>
      )}

      {/* Title block */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-indigo-600 animate-pulse" />
          <span>Leave Request & Verification Hub</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Submit off-duty requests or audit employee timetables with real-time historical verification context.
        </p>
      </div>

      <div className={isAdminLoggedIn ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "grid grid-cols-1 md:grid-cols-2 gap-8"}>
        {/* Left Column: Register Request Bento Box */}
        <div className={isAdminLoggedIn ? "space-y-6" : "space-y-6 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 space-y-0"}>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" />
                <span>Submit Leave Request</span>
              </h3>

              <form onSubmit={handleRequestSubmit} className="space-y-4">
                {/* Select Employee */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                    Your Profile Name
                  </label>
                  {loggedInEmployee ? (
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <p className="text-xs font-bold text-slate-800 animate-fadeIn">{loggedInEmployee.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{loggedInEmployee.id} • Locked Session</p>
                    </div>
                  ) : (
                    <select
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        setEmployeeFilterId(e.target.value);
                      }}
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">-- Choose Employee Account --</option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Leave Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      Leave Type
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as any)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Vacation">Vacation</option>
                      <option value="Sick">Sick</option>
                      <option value="Personal">Personal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      Days Limit
                    </label>
                    <div className="text-2xs p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-between font-mono">
                      <span>Config Allotted</span>
                      <strong className="text-slate-800">No Limit</strong>
                    </div>
                  </div>
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                    Justification / Reason Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide explanatory notes (e.g. sick symptoms, travel notes, appointment cards)..."
                    value={leaveNotes}
                    onChange={(e) => setLeaveNotes(e.target.value)}
                    required
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                {/* Feedback Alerts */}
                {submissionStatus === 'success' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Leave request submitted successfully. Awaiting Admin review!</span>
                  </div>
                )}
                {submissionStatus === 'error' && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Invalid input or start date exceeds end date.</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs hover:shadow-indigo-600/10 cursor-pointer transition-all"
                >
                  Apply for Time-Off
                </button>
              </form>
            </div>
          </div>

          {/* Individual Employee History Display */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              <span>My Requests Registry</span>
            </h3>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                Narrow down by your ID
              </label>
              {loggedInEmployee ? (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mb-4 font-mono text-[10px] text-slate-500">
                  Showing historical records for logged-in profile <strong className="text-slate-700">{loggedInEmployee.name}</strong>
                </div>
              ) : (
                <select
                  value={employeeFilterId}
                  onChange={(e) => setEmployeeFilterId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
                >
                  <option value="">-- Choose Profile to view records --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id})
                    </option>
                  ))}
                </select>
              )}

              {!employeeFilterId ? (
                <p className="text-2xs text-slate-400 font-mono py-4 text-center">
                  Select your name to load individual historical requests.
                </p>
              ) : filteredEmployeeRequests.length === 0 ? (
                <p className="text-2xs text-slate-400 font-mono py-4 text-center">
                  No previous records found for this employee profile.
                </p>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {filteredEmployeeRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-minify">
                        <span className="font-bold text-slate-800 text-2xs uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {req.leaveType}
                        </span>
                        <span className={`text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded-full ${
                          req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          req.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        {req.startDate} {req.startDate !== req.endDate ? `to ${req.endDate}` : ''}
                      </div>
                      {req.notes && (
                        <p className="text-[10px] italic text-slate-500 bg-white p-2 rounded border border-slate-100 line-clamp-2 leading-relaxed">
                          "{req.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Screen: Admin Master Table for Reviews */}
        {isAdminLoggedIn && (
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Reviews list card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Master Requests Log
                      </h3>
                      <p className="text-3xs text-slate-400 font-mono uppercase mt-0.5">
                        Review employee time-off requests
                      </p>
                    </div>

                    {/* Filter tabs */}
                    <select
                      value={adminFilter}
                      onChange={(e) => setAdminFilter(e.target.value as any)}
                      className="text-xs p-1.5 border border-slate-200/60 rounded-lg outline-none cursor-pointer bg-slate-50 font-semibold"
                    >
                      <option value="all">All Request Statuses</option>
                      <option value="Pending">Pending Review</option>
                      <option value="Approved">Approved Log</option>
                      <option value="Rejected">Rejected Log</option>
                    </select>
                  </div>

                  {/* Submissions list */}
                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {adminFilteredRequests.length === 0 ? (
                      <p className="py-16 text-center text-slate-400 text-2xs font-mono">
                        No matching requests under query filter '{adminFilter}'.
                      </p>
                    ) : (
                      adminFilteredRequests.map((req) => {
                        const isSelected = selectedRequestForContext?.id === req.id;
                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequestForContext(req)}
                            className={`p-4 transition-all cursor-pointer text-xs space-y-2 text-slate-700 hover:bg-slate-50/50 ${
                              isSelected ? 'bg-indigo-50/60 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-800">{req.employeeName}</h4>
                              <span className="text-[10px] font-mono text-slate-400 font-semibold">{req.submittedAt ? req.submittedAt.split('T')[0] : ''}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-500 font-mono text-2xs uppercase">
                                Type: <strong className="text-indigo-600 font-bold">{req.leaveType}</strong>
                              </span>
                              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                                req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                req.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                              }`}>
                                {req.status}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600">
                              <strong>Date Span:</strong> {req.startDate} to {req.endDate}
                            </div>

                            {/* Quick Admin Decision Actions if Pending */}
                            {isAdminLoggedIn && req.status === 'Pending' && (
                              <div className="flex items-center space-x-2 pt-1.5 select-none" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => onDecideLeaveRequest(req.id, 'Approved')}
                                  className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 text-emerald-700 hover:text-white text-3xs font-bold transition-all cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>APPROVE</span>
                                </button>
                                <button
                                  onClick={() => onDecideLeaveRequest(req.id, 'Rejected')}
                                  className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 text-rose-700 hover:text-white text-3xs font-bold transition-all cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>REJECT</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center">
                  Total Requests Catalogued: {leaveRequests.length}
                </div>
              </div>

              {/* Admin context evaluation box */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Employee Context Hub
                  </h3>
                  <p className="text-3xs text-slate-400 font-mono uppercase mt-0.5">
                    Automated background data verification
                  </p>
                </div>

                {!selectedRequestForContext ? (
                  <div className="py-24 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                    <User className="w-8 h-8 mx-auto text-slate-300 stroke-1 mb-2" />
                    <p className="text-2xs font-mono">
                      Select a request on the left grid to generate background context audit.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Selected Request Target Profile */}
                    <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-150/40 space-y-2">
                      <p className="text-[10px] font-bold uppercase font-mono text-indigo-500">Currently Selecting</p>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold text-slate-900">{selectedRequestForContext.employeeName}</h4>
                        <span className="font-mono text-xs font-semibold bg-white px-2 py-0.5 rounded shadow-3xs text-slate-600">{selectedRequestForContext.employeeId}</span>
                      </div>
                      {selectedRequestForContext.notes && (
                        <p className="text-2xs text-slate-600 italic leading-relaxed bg-white p-2.5 rounded border border-slate-100">
                          <strong>Reason:</strong> "{selectedRequestForContext.notes}"
                        </p>
                      )}
                    </div>

                    {/* Analysis Metrics */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Historical Statistics</h4>
                      
                      <div className="grid grid-cols-2 gap-3 font-mono text-2xs text-slate-600">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                          <span>Total Days Logs</span>
                          <strong className="text-xs text-slate-800 mt-1">{contextEmployeeStats?.totalDays} Active Shifts</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                          <span>Punctual Rate</span>
                          <strong className="text-xs text-slate-800 mt-1">
                            {contextEmployeeStats?.totalDays && contextEmployeeStats.totalDays > 0 
                              ? `${Math.round(((contextEmployeeStats.presents - contextEmployeeStats.lates) / contextEmployeeStats.presents) * 100) || 100}%` 
                              : '100%'}
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                          <span>Late Clock-ins</span>
                          <strong className={`text-xs mt-1 ${contextEmployeeStats?.lates && contextEmployeeStats.lates > 0 ? 'text-amber-600 font-bold' : 'text-slate-800'}`}>
                            {contextEmployeeStats?.lates} Flags
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                          <span>Early Departures</span>
                          <strong className={`text-xs mt-1 ${contextEmployeeStats?.earlyExits && contextEmployeeStats.earlyExits > 0 ? 'text-amber-600 font-bold' : 'text-slate-800'}`}>
                            {contextEmployeeStats?.earlyExits} Flags
                          </strong>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Dept & Segment</span>
                          <span className="font-bold text-slate-705">{contextEmployeeStats?.department}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Hourly Wage Rate</span>
                          <span className="font-bold text-indigo-650">{settings.currency} {contextEmployeeStats?.hourlyRate}/hr</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Previous Excused Leaves</span>
                          <span className="font-bold text-slate-705">{contextEmployeeStats?.onLeavesCount} Approved</span>
                        </div>
                      </div>
                    </div>

                    {/* Micro Attendance History Table */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Recent Logs Feed</h4>
                      <div className="border border-slate-100 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-3xs font-mono">
                          <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                            <tr>
                              <th className="p-2">Date</th>
                              <th className="p-2">Punches</th>
                              <th className="p-2 text-right">Raw Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-650">
                            {contextEmployeeStats?.recentRecords.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-slate-400">No shifts recorded yet.</td>
                              </tr>
                            ) : (
                              contextEmployeeStats?.recentRecords.map((rec) => (
                                <tr key={rec.date} className="hover:bg-slate-50/20">
                                  <td className="p-2 font-bold">{rec.date}</td>
                                  <td className="p-2">
                                    {rec.entryTime ? `${rec.entryTime} → ${rec.exitTime || '--:--'}` : 'Excused / Paid'}
                                  </td>
                                  <td className="p-2 text-right font-bold text-indigo-600 uppercase">{rec.status}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
