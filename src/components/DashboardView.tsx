import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  Hourglass, 
  Coffee, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight,
  UserPlus,
  RefreshCw,
  Mail,
  Sliders,
  Sparkles,
  Bell,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  Megaphone,
  Send
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings, AppNotification, LeaveRequest } from '../types';

interface DashboardViewProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  onNavigateToView: (view: string) => void;
  notifications: AppNotification[];
  leaveRequests: LeaveRequest[];
  onMarkNotificationRead?: (id: string) => void;
  onEvaluateEmployee?: (id: string) => void;
  onSendNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'alert' | 'success',
    employeeId?: string
  ) => void;
}

export default function DashboardView({
  employees,
  attendance,
  settings,
  onNavigateToView,
  notifications,
  leaveRequests,
  onMarkNotificationRead,
  onEvaluateEmployee,
  onSendNotification,
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // For mock real-time dashboard refresh click!
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeSelfieUrl, setActiveSelfieUrl] = useState<{ url: string; label: string; name: string } | null>(null);

  // States for Administrative Memo / Notification dispatcher
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'alert' | 'success'>('info');
  const [notifSuccessText, setNotifSuccessText] = useState('');

  const handleDispatchNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendNotification) return;

    if (!notifTitle.trim() || !notifMessage.trim()) {
      alert('Please fill in the notification Title and Message before sending.');
      return;
    }

    onSendNotification(
      notifTitle.trim(),
      notifMessage.trim(),
      notifType,
      targetEmployeeId || undefined // empty = broadcast
    );

    // Reset inputs
    setNotifTitle('');
    setNotifMessage('');
    setTargetEmployeeId('');
    
    setNotifSuccessText(
      targetEmployeeId 
        ? `Successfully sent Memo to ${employees.find(emp => emp.id === targetEmployeeId)?.name || targetEmployeeId}!`
        : 'Broadcast announcement successfully published, all active employee noticeboards updated!'
    );
    setTimeout(() => setNotifSuccessText(''), 5500);
  };

  // Triggering visual refresh
  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculations for Today
  const todayAttendance = attendance.filter(rec => rec.date === todayStr);
  const activeEmployees = employees.filter(emp => emp.status === 'Active');

  const totalEmployeesPresentToday = todayAttendance.filter(rec => {
    // Present includes anyone who has entry time or entry time 2 and is not absent
    return (rec.entryTime || rec.entryTime2) && !rec.status.includes('Absent');
  }).length;

  const totalOnLunchToday = todayAttendance.filter(rec => rec.status === 'On Lunch').length;

  // Let's count overtime completed or logged today
  const totalOvertimeToday = todayAttendance.reduce((total, rec) => total + (rec.overtime || 0), 0);

  // Total working hours today completed (exit logged)
  const totalWorkingHoursToday = todayAttendance.reduce((total, rec) => total + (rec.totalHours || 0), 0);

  // Detailed statuses of all ACTIVE employees for Today's live feed
  const liveFeed = activeEmployees.map(emp => {
    const todayRec = todayAttendance.find(rec => rec.employeeId === emp.id);
    let status = 'Absent';
    let labelColor = 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]';

    if (todayRec) {
      status = todayRec.status;
      if (status === 'On Lunch') {
        labelColor = 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]';
      } else if (status === 'Present') {
        labelColor = 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]';
      } else if (status.includes('Late Entry')) {
        labelColor = 'bg-indigo-55 bg-opacity-20 text-[#4f46e5] border-[#c7d2fe]';
      } else if (status.includes('Early Exit')) {
        labelColor = 'bg-orange-50 text-orange-800 border-orange-200';
      } else {
        labelColor = 'bg-gray-100 text-gray-700 border-gray-200';
      }
    }

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      email: emp.email,
      entryTime: todayRec?.entryTime || '--:--',
      lunchOut: todayRec?.lunchOut || '--:--',
      lunchIn: todayRec?.lunchIn || '--:--',
      exitTime: todayRec?.exitTime || '--:--',
      entryTime2: todayRec?.entryTime2 || '--:--',
      exitTime2: todayRec?.exitTime2 || '--:--',
      dinnerOut: todayRec?.dinnerOut || '--:--',
      dinnerIn: todayRec?.dinnerIn || '--:--',
      status,
      labelColor,
      totalHours: todayRec?.totalHours || 0,
      locationIn: todayRec?.locationIn || '',
      locationOut: todayRec?.locationOut || '',
      locationLunchOut: todayRec?.locationLunchOut || '',
      locationLunchIn: todayRec?.locationLunchIn || '',
      locationDinnerOut: todayRec?.locationDinnerOut || '',
      locationDinnerIn: todayRec?.locationDinnerIn || '',
      locationEntry2: todayRec?.locationEntry2 || '',
      locationExit2: todayRec?.locationExit2 || '',
      photoIn: todayRec?.photoIn || '',
      photoOut: todayRec?.photoOut || '',
      photoLunchOut: todayRec?.photoLunchOut || '',
      photoLunchIn: todayRec?.photoLunchIn || '',
      photoDinnerOut: todayRec?.photoDinnerOut || '',
      photoDinnerIn: todayRec?.photoDinnerIn || '',
      photoEntry2: todayRec?.photoEntry2 || '',
      photoExit2: todayRec?.photoExit2 || '',
    };
  });

  // Filters search
  const filteredFeed = liveFeed.filter(item => {
    const matchSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchSearch;
    if (statusFilter === 'PRESENT') return matchSearch && item.status !== 'Absent';
    if (statusFilter === 'LUNCH') return matchSearch && item.status === 'On Lunch';
    if (statusFilter === 'ABSENT') return matchSearch && item.status === 'Absent';
    return matchSearch;
  });

  // Calculate generic aggregate stats to build unique SVG curve widget
  const attendancePercentage = activeEmployees.length > 0 
    ? Math.round((totalEmployeesPresentToday / activeEmployees.length) * 100) 
    : 0;

  return (
    <div key={refreshKey} className="space-y-8 animate-fadeIn" id="dashboard-view-container">
      {/* Title block with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Workforce Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry and schedule metrics of Apex Tech Solutions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Real-time sync visual indicator */}
          <button
            onClick={triggerRefresh}
            id="btn-sync-refresh"
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
            <span>Force Real-Time Refresh</span>
          </button>
          
          <button
            onClick={() => onNavigateToView('terminal')}
            className="flex items-center space-x-1 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-indigo-600/15 cursor-pointer transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Open Attendance Desk</span>
          </button>
        </div>
      </div>

      {/* Analytics bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Present Rate */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col justify-between min-h-[135px]">
          <div className="text-[#6b7280] text-xs uppercase tracking-wider font-semibold">
            Present Today
          </div>
          <div className="text-[28px] font-bold text-gray-900 my-1 font-sans">
            {totalEmployeesPresentToday} <span className="text-sm font-normal text-gray-400">/ {activeEmployees.length} active</span>
          </div>
          <div className="text-xs flex items-center gap-1 text-[#10b981] font-semibold">
            <span>↑ {attendancePercentage}% Checked-In</span>
          </div>
        </div>

        {/* Card 2: Lunch break */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col justify-between min-h-[135px]">
          <div className="text-[#6b7280] text-xs uppercase tracking-wider font-semibold">
            Currently On Lunch
          </div>
          <div className="text-[28px] font-bold text-gray-900 my-1 font-sans">
            {totalOnLunchToday} <span className="text-sm font-normal text-gray-400">on break</span>
          </div>
          <div className="text-xs flex items-center gap-1 text-amber-600 font-semibold">
            <span>{settings.lunchDurationMinutes} mins allotted</span>
          </div>
        </div>

        {/* Card 3: Work hours today */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col justify-between min-h-[135px]">
          <div className="text-[#6b7280] text-xs uppercase tracking-wider font-semibold">
            Total Working Hours
          </div>
          <div className="text-[28px] font-bold text-gray-900 my-1 font-sans">
            {totalWorkingHoursToday.toFixed(1)} <span className="text-sm font-normal text-gray-400">h logged</span>
          </div>
          <div className="text-xs flex items-center gap-1 text-gray-500 font-semibold">
            <span>Active shift output</span>
          </div>
        </div>

        {/* Card 4: Overtime accumulated */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col justify-between min-h-[135px]">
          <div className="text-[#6b7280] text-xs uppercase tracking-wider font-semibold">
            Overtime Today
          </div>
          <div className="text-[28px] font-bold text-[#6366f1] my-1 font-sans">
            +{totalOvertimeToday.toFixed(1)} <span className="text-sm font-normal text-gray-450">h accumulated</span>
          </div>
          <div className="text-xs flex items-center gap-1 text-[#10b981] font-semibold">
            <span>↑ {(totalOvertimeToday * settings.overtimeRateMultiplier).toFixed(1)}h multiplier balance</span>
          </div>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Live attendance table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Live Attendance Roster (Today)
                </h3>
                <p className="text-3xs text-slate-400 font-mono uppercase mt-0.5">
                  Showing active core employees logged on date {todayStr}
                </p>
              </div>

              {/* Status Tabs filters */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                {['ALL', 'PRESENT', 'LUNCH', 'ABSENT'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      statusFilter === st 
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick search input */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, ID, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 hover:border-0 outline-none text-xs text-slate-600 placeholder-slate-400 w-full focus:outline-none focus:ring-0"
              />
            </div>

            {/* Attendance list table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-wider font-mono">
                    <th className="py-3 px-6">ID & Staff Name</th>
                    <th className="py-3 px-4">Dept</th>
                    <th className="py-3 px-4">Punch In</th>
                    <th className="py-3 px-4 text-amber-700 bg-amber-50/20">Lunch Out</th>
                    <th className="py-3 px-4 text-teal-700 bg-teal-50/20">Lunch In</th>
                    <th className="py-3 px-4 text-rose-700 bg-rose-50/20">Dinner Out</th>
                    <th className="py-3 px-4 text-emerald-700 bg-emerald-50/20">Dinner In</th>
                    <th className="py-3 px-4">Exit</th>
                    <th className="py-3 px-4">Hours</th>
                    <th className="py-3 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {filteredFeed.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 text-2xs font-mono">
                        No workers match search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFeed.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-3 px-6 font-medium">
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-semibold">{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{item.id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{item.department}</td>
                        <td className="py-3 px-4 font-mono text-slate-800">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold">{item.entryTime}</span>
                              {item.photoIn && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoIn, label: 'Day Shift Entry', name: item.name })}
                                  className="inline-flex items-center text-[8px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-0.5 rounded-full border border-indigo-150 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Check-In Selfie"
                                >
                                  <img src={item.photoIn} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationIn && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationIn}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[8px] text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Check In GPS Location"
                                >
                                  <MapPin className="w-2 h-2" />
                                </a>
                              )}
                            </div>
                            {item.entryTime2 !== '--:--' && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-indigo-600 font-bold font-mono uppercase">S2: {item.entryTime2}</span>
                                {item.photoEntry2 && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveSelfieUrl({ url: item.photoEntry2, label: 'Night Shift Entry', name: item.name })}
                                    className="inline-flex items-center text-[8px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-0.5 rounded-full border border-indigo-150 transition-all shrink-0 cursor-pointer shadow-3xs"
                                    title="View Shift 2 Entry Selfie"
                                  >
                                    <img src={item.photoEntry2} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                  </button>
                                )}
                                {item.locationEntry2 && (
                                  <a
                                    href={`https://www.google.com/maps?q=${item.locationEntry2}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-[8px] text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-150 transition-colors shrink-0"
                                    title="Shift 2 GPS Location"
                                  >
                                    <MapPin className="w-2 h-2" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Lunch Out Column */}
                        <td className="py-3 px-4 font-mono text-xs">
                          {item.lunchOut !== '--:--' ? (
                            <div className="flex items-center gap-1 flex-wrap text-amber-700 bg-amber-50 border border-amber-100/50 rounded-lg px-2 py-1 w-fit shadow-3xs">
                              <span className="font-bold text-amber-600 text-[9px] uppercase font-sans">Out</span>
                              <span className="font-semibold">{item.lunchOut}</span>
                              {item.photoLunchOut && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoLunchOut, label: 'Lunch Out', name: item.name })}
                                  className="inline-flex items-center text-[8px] p-0.5 rounded-full border border-amber-200 bg-white hover:bg-amber-100 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Lunch Out Selfie"
                                >
                                  <img src={item.photoLunchOut} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationLunchOut && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationLunchOut}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center p-0.5 text-teal-600 bg-white hover:bg-teal-50 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Lunch Out GPS"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">--:--</span>
                          )}
                        </td>

                        {/* Lunch In Column */}
                        <td className="py-3 px-4 font-mono text-xs">
                          {item.lunchIn !== '--:--' ? (
                            <div className="flex items-center gap-1 flex-wrap text-teal-700 bg-teal-50 border border-teal-100/50 rounded-lg px-2 py-1 w-fit shadow-3xs">
                              <span className="font-bold text-teal-600 text-[9px] uppercase font-sans">In</span>
                              <span className="font-semibold">{item.lunchIn}</span>
                              {item.photoLunchIn && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoLunchIn, label: 'Lunch In', name: item.name })}
                                  className="inline-flex items-center text-[8px] p-0.5 rounded-full border border-teal-200 bg-white hover:bg-teal-100 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Lunch Return Selfie"
                                >
                                  <img src={item.photoLunchIn} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationLunchIn && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationLunchIn}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center p-0.5 text-teal-600 bg-white hover:bg-teal-50 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Lunch Return GPS"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : item.lunchOut !== '--:--' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase bg-amber-500 text-white animate-pulse font-sans">
                              On Break (लंच पर)
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">--:--</span>
                          )}
                        </td>

                        {/* Dinner Out Column */}
                        <td className="py-3 px-4 font-mono text-xs">
                          {item.dinnerOut !== '--:--' ? (
                            <div className="flex items-center gap-1 flex-wrap text-rose-700 bg-rose-50 border border-rose-100/50 rounded-lg px-2 py-1 w-fit shadow-3xs">
                              <span className="font-bold text-rose-600 text-[9px] uppercase font-sans">Out</span>
                              <span className="font-semibold">{item.dinnerOut}</span>
                              {item.photoDinnerOut && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoDinnerOut, label: 'Dinner Out', name: item.name })}
                                  className="inline-flex items-center text-[8px] p-0.5 rounded-full border border-rose-200 bg-white hover:bg-rose-100 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Dinner Out Selfie"
                                >
                                  <img src={item.photoDinnerOut} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationDinnerOut && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationDinnerOut}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center p-0.5 text-teal-600 bg-white hover:bg-teal-50 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Dinner Out GPS"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">--:--</span>
                          )}
                        </td>

                        {/* Dinner In Column */}
                        <td className="py-3 px-4 font-mono text-xs">
                          {item.dinnerIn !== '--:--' ? (
                            <div className="flex items-center gap-1 flex-wrap text-emerald-700 bg-emerald-50 border border-emerald-100/50 rounded-lg px-2 py-1 w-fit shadow-3xs">
                              <span className="font-bold text-emerald-600 text-[9px] uppercase font-sans">In</span>
                              <span className="font-semibold">{item.dinnerIn}</span>
                              {item.photoDinnerIn && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoDinnerIn, label: 'Dinner In', name: item.name })}
                                  className="inline-flex items-center text-[8px] p-0.5 rounded-full border border-emerald-200 bg-white hover:bg-emerald-150 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Dinner Return Selfie"
                                >
                                  <img src={item.photoDinnerIn} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationDinnerIn && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationDinnerIn}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center p-0.5 text-teal-600 bg-white hover:bg-teal-50 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Dinner Return GPS"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : item.dinnerOut !== '--:--' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase bg-rose-500 text-white animate-pulse font-sans">
                              On Dinner (डिनर पर)
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">--:--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-800">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold">{item.exitTime}</span>
                              {item.photoOut && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSelfieUrl({ url: item.photoOut, label: 'Day Shift Exit', name: item.name })}
                                  className="inline-flex items-center text-[8px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-0.5 rounded-full border border-indigo-150 transition-all shrink-0 cursor-pointer shadow-3xs"
                                  title="View Day Shift Exit Selfie"
                                >
                                  <img src={item.photoOut} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                </button>
                              )}
                              {item.locationOut && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.locationOut}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[8px] text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-150 transition-colors shrink-0"
                                  title="Check Out GPS Location"
                                >
                                  <MapPin className="w-2 h-2" />
                                </a>
                              )}
                            </div>
                            {item.exitTime2 !== '--:--' && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-indigo-600 font-bold font-mono uppercase">S2: {item.exitTime2}</span>
                                {item.photoExit2 && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveSelfieUrl({ url: item.photoExit2, label: 'Night Shift Exit', name: item.name })}
                                    className="inline-flex items-center text-[8px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-0.5 rounded-full border border-indigo-150 transition-all shrink-0 cursor-pointer shadow-3xs"
                                    title="View Shift 2 Exit Selfie"
                                  >
                                    <img src={item.photoExit2} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                                  </button>
                                )}
                                {item.locationExit2 && (
                                  <a
                                    href={`https://www.google.com/maps?q=${item.locationExit2}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-[8px] text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-150 transition-colors shrink-0"
                                    title="Shift 2 Exit GPS Location"
                                  >
                                    <MapPin className="w-2 h-2" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-600">
                          {item.totalHours > 0 ? `${item.totalHours.toFixed(2)}h` : '--'}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <span className={`inline-block border text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${item.labelColor}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase tracking-wide">
            <span>{filteredFeed.length} of {activeEmployees.length} total active workforce catalogued</span>
            <button
              onClick={() => onNavigateToView('employees')}
              className="text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 font-bold cursor-pointer"
            >
              <span>Manage profiles</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Visual Shift Insights & Schedule rules */}
        <div className="space-y-6">
          {/* Bento Panel: Send Official Memo / Alert Note (NEW) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Send Employee Memo / alert</span>
              </h3>
              <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">
                Notice Board
              </span>
            </div>

            {notifSuccessText && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-[#065f46] rounded-xl text-3xs font-medium leading-relaxed">
                ✓ {notifSuccessText}
              </div>
            )}

            <form onSubmit={handleDispatchNotification} className="space-y-3.5 text-xs">
              {/* Target Selector */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-450 mb-1 font-mono tracking-wide">
                  Receipt Target
                </label>
                <select
                  value={targetEmployeeId}
                  onChange={(e) => setTargetEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-xs font-medium"
                >
                  <option value="">📢 All Employees (Broadcast)</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      👤 {emp.name} ({emp.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-450 mb-1 font-mono tracking-wide">
                  Memo Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mandatory Gate Selfie Alert"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-xs font-medium bg-white"
                  required
                />
              </div>

              {/* Message Description Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-450 mb-1 font-mono tracking-wide">
                  Detailed Message Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Write clear instructions for the noticeboard alert..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-xs font-medium bg-white resize-none"
                  required
                />
              </div>

              {/* Color/Priority Type selection */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-450 mb-1 font-mono tracking-wide">
                  Priority Style / Flag
                </label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-xs font-medium"
                >
                  <option value="info">🔵 Info (Blue Memo)</option>
                  <option value="warning">🟡 Warning (Amber Alert)</option>
                  <option value="alert">🔴 Urgent (Rose Notice)</option>
                  <option value="success">🟢 OK (Green Pass)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-500/25 cursor-pointer"
              >
                <Send className="w-4 h-4 shrink-0 animate-bounce" />
                <span>Send Now</span>
              </button>
            </form>
          </div>

          {/* Bento Panel: Real-time Shift Alerts */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-rose-50/60 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Real-Time Push Alerts</span>
              </h3>
              {notifications.filter(n => !n.read && n.isAdmin).length > 0 && (
                <span className="bg-rose-100 text-rose-700 text-3xs font-bold px-2 py-0.5 rounded-full uppercase animate-pulse">
                  {notifications.filter(n => !n.read && n.isAdmin).length} New
                </span>
              )}
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {notifications.filter(n => n.isAdmin).length === 0 ? (
                <p className="text-2xs text-slate-400 font-mono py-6 text-center">
                  No core administrative alerts triggered today.
                </p>
              ) : (
                notifications.filter(n => n.isAdmin).map((notif) => (
                  <div 
                    key={notif.id}
                    className={`p-2.5 rounded-xl border flex gap-2.5 items-start transition-all ${
                      notif.read 
                        ? 'bg-slate-50/50 border-slate-100 text-slate-500' 
                        : 'bg-rose-50/40 border-rose-100 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {notif.type === 'alert' && <ShieldAlert className="w-4 h-4 text-rose-500" />}
                      {notif.type !== 'warning' && notif.type !== 'alert' && <Bell className="w-4 h-4 text-indigo-500" />}
                    </div>
                    <div className="flex-1 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800">{notif.title}</span>
                        <span className="text-[9px] font-mono text-slate-400">{notif.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">{notif.message}</p>
                      {!notif.read && onMarkNotificationRead && (
                        <button 
                          onClick={() => onMarkNotificationRead(notif.id)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold block pt-1 cursor-pointer transition-colors"
                        >
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bento Panel: Leave Review Queue */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-50/60 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Pending Leave Queue</span>
              </h3>
              {leaveRequests.filter(l => l.status === 'Pending').length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-3xs font-bold px-2 py-0.5 rounded-full">
                  {leaveRequests.filter(l => l.status === 'Pending').length} Queue
                </span>
              )}
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {leaveRequests.filter(l => l.status === 'Pending').length === 0 ? (
                <p className="text-2xs text-slate-400 font-mono py-6 text-center">
                  All employee leave requests cleared. Nice work!
                </p>
              ) : (
                leaveRequests.filter(l => l.status === 'Pending').map((req) => (
                  <div
                    key={req.id}
                    onClick={() => onNavigateToView('leaves')}
                    className="p-3 rounded-xl bg-indigo-50/20 hover:bg-indigo-50 border border-indigo-100/30 transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{req.employeeName}</span>
                      <span className="font-mono text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase">
                        {req.leaveType}
                      </span>
                    </div>
                    <div className="text-2xs text-slate-500 flex justify-between">
                      <span>Span: {req.startDate} to {req.endDate}</span>
                      <span className="text-indigo-600 font-bold flex items-center gap-0.5 hover:underline">
                        Audit History →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bento Panel: Check-In Performance */}
          <div className="bg-gradient-to-tr from-white to-slate-50 p-6 rounded-2xl shadow-sm border border-slate-100/80">
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Check-In Performance
            </h3>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest leading-relaxed mb-4">
              Attendance saturation today
            </p>
            <div className="flex items-end justify-between h-20 mb-4 px-2 select-none">
              {/* Simulated mini analytics curve bars */}
              {[40, 55, 75, 45, 60, 90, 100].map((val, idx) => {
                const dayLabel = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][idx];
                const isToday = idx === 0; // represent today Monday
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 space-y-1.5">
                    <div className="w-6 bg-slate-100 rounded-lg h-16 relative overflow-hidden">
                      <div 
                        style={{ height: `${val}%` }}
                        className={`absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-1000 ${
                          isToday 
                            ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' 
                            : 'bg-indigo-200/50'
                        }`} 
                      />
                    </div>
                    <span className={`text-[10px] font-mono tracking-tighter ${isToday ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/30 text-[11px] text-slate-600 leading-normal flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Daily checks peaked at <strong className="font-extrabold text-indigo-950">100% capacity</strong> during last weekend shift rosters.
              </span>
            </div>
             </div>

          {/* Settings reference rules bento */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Company Schedule Regulations
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-500">Standard Work Shift</span>
                <span className="font-bold text-slate-800 font-mono">
                  {settings.standardHours} Hours / Day
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-500">Late Cutoff Threshold</span>
                <span className="font-bold text-slate-400 font-mono">
                  &gt; {settings.workStartHour} AM
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-500">Standard Rest Margin</span>
                <span className="font-mono text-slate-800">
                  {settings.lunchDurationMinutes} minutes (Auto)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-500">Overtime Rate Bonus</span>
                <span className="text-indigo-600 font-bold font-mono">
                  {settings.overtimeRateMultiplier}x per standard rate
                </span>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100 mt-5">
              <button
                onClick={() => onNavigateToView('reports')}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-100 text-slate-700 hover:text-indigo-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Compile Monthly Payrolls</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeSelfieUrl && (
        <div 
          onClick={() => setActiveSelfieUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn cursor-pointer"
        >
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 relative text-center space-y-4 cursor-default animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold font-mono text-indigo-650 uppercase tracking-widest block">{activeSelfieUrl.label} Verification</span>
              <button 
                onClick={() => setActiveSelfieUrl(null)}
                className="text-slate-400 hover:text-slate-600 font-bold font-sans text-xs cursor-pointer p-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="text-left">
              <span className="text-sm font-black text-slate-800 block">{activeSelfieUrl.name}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Punch verification photo captures precise location backdrop.</span>
            </div>

            <div className="rounded-2xl overflow-hidden aspect-[3/4] max-w-[240px] mx-auto border border-slate-100 shadow-sm bg-slate-950 flex items-center justify-center">
              <img 
                src={activeSelfieUrl.url} 
                alt="Selfie Backdrop Verification" 
                className="w-full h-full object-cover" 
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveSelfieUrl(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-3xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>

            <p className="text-3xs text-slate-400 font-mono uppercase tracking-widest pt-1 border-t border-slate-50">
              Secure Punch Verification Protocol
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
