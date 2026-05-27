import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Coffee,
  Search,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { Employee, AttendanceRecord } from '../types';

interface MyAttendanceViewProps {
  loggedInEmployee: Employee;
  attendance: AttendanceRecord[];
  onNavigateToView?: (view: string) => void;
}

export default function MyAttendanceView({
  loggedInEmployee,
  attendance,
  onNavigateToView
}: MyAttendanceViewProps) {
  // Current month state format: 'YYYY-MM'
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const defaultMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr);
  const [filterType, setFilterType] = useState<'All' | 'Present' | 'Absent' | 'Weekly Off'>('All');

  // Filter attendance records specifically belonging to this logged in employee
  const myLogs = attendance.filter(record => record.employeeId === loggedInEmployee.id);

  // Generate all dates in the selected month
  const generateMonthDates = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const dateList: Date[] = [];
    const dateCursor = new Date(year, month - 1, 1);
    
    while (dateCursor.getMonth() === month - 1) {
      dateList.push(new Date(dateCursor));
      dateCursor.setDate(dateCursor.getDate() + 1);
    }
    return dateList;
  };

  const datesInMonth = generateMonthDates(selectedMonth);

  // Map calendar dates to attendance records
  const processedLogs = datesInMonth.map(date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const compareDate = new Date(date);
    compareDate.setHours(0,0,0,0);
    const compareToday = new Date();
    compareToday.setHours(0,0,0,0);
    const isFuture = compareDate > compareToday;
    const isToday = compareDate.getTime() === compareToday.getTime();
    
    // Find matching record
    const matchedRecord = myLogs.find(log => log.date === dateStr);
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Customize weekend as Sat/Sun

    let status: 'Present' | 'Absent' | 'Weekly Off' | 'Late Entry' | 'Night Shift' | 'Pending' | 'Future' = 'Absent';
    let detail = matchedRecord;

    if (isFuture) {
      status = 'Future';
    } else if (matchedRecord) {
      if (matchedRecord.status === 'Late Entry') {
        status = 'Late Entry';
      } else if (matchedRecord.status === 'Night Shift') {
        status = 'Night Shift';
      } else {
        status = 'Present';
      }
    } else if (isWeekend) {
      status = 'Weekly Off';
    } else if (isToday) {
      status = 'Pending'; // Today is active, and no check-in yet
    }

    return {
      dateObj: date,
      dateString: dateStr,
      dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
      formattedDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status,
      isWeekend,
      clockIn: detail?.entryTime || detail?.entryTime2 || '--:--',
      lunchOut: detail?.lunchOut || '--:--',
      lunchIn: detail?.lunchIn || '--:--',
      clockOut: detail?.exitTime || detail?.exitTime2 || '--:--',
      hours: detail?.totalHours || 0,
      overtime: detail?.overtime || 0
    };
  });

  // Filter logs based on dropdown search
  const filteredLogs = processedLogs.filter(log => {
    if (log.status === 'Future') return false; // Hide future dates from list
    if (filterType === 'All') return true;
    if (filterType === 'Present') return log.status === 'Present' || log.status === 'Late Entry' || log.status === 'Night Shift';
    if (filterType === 'Absent') return log.status === 'Absent' || log.status === 'Pending';
    if (filterType === 'Weekly Off') return log.status === 'Weekly Off';
    return true;
  });

  // CSV Export Engine
  const handleDownloadCSV = () => {
    const headers = [
      'Date', 
      'Day', 
      'Attendance status', 
      'Clock In', 
      'Lunch Out', 
      'Lunch In', 
      'Clock Out', 
      'Total Hours (Deducted)', 
      'Overtime Hours'
    ];

    const csvContent = processedLogs
      .filter(log => log.status !== 'Future')
      .map(log => {
        const rowStatus = log.status === 'Pending' ? 'No punch made (Absent/Pending)' : log.status;
        return [
          log.dateString,
          log.dayLabel,
          rowStatus,
          log.clockIn,
          log.lunchOut,
          log.lunchIn,
          log.clockOut,
          log.hours.toFixed(2),
          log.overtime.toFixed(2)
        ].join(',');
      });

    const csvRows = [headers.join(','), ...csvContent].join('\n');
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const docName = `Attendance_${loggedInEmployee.id}_${selectedMonth}.csv`;
    link.setAttribute('download', docName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute metrics for selected month
  const totalDaysInSelection = processedLogs.filter(l => l.status !== 'Future').length;
  const presentDaysCount = processedLogs.filter(l => ['Present', 'Late Entry', 'Night Shift'].includes(l.status)).length;
  const absentDaysCount = processedLogs.filter(l => l.status === 'Absent').length;
  const officialOffDaysCount = processedLogs.filter(l => l.status === 'Weekly Off').length;
  const sumWorkHours = processedLogs.reduce((acc, current) => acc + current.hours, 0);

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="my-attendance-sheet">
      {/* Page Back Link / Navigation Tabs */}
      {onNavigateToView && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-150/75 shadow-3xs select-none">
          <button 
            type="button"
            id="btn-back-to-terminal"
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
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/90 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Punch Card
            </button>
            <button
              onClick={() => onNavigateToView('leaves')}
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/90 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Leave Requests
            </button>
          </div>
        </div>
      )}

      {/* Top Welcome Title Widget */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-3xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-50 text-indigo-700 p-2 rounded-xl border border-indigo-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            </span>
            <div>
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest leading-none">Attendance Statement</span>
              <h1 className="text-lg font-black text-slate-9 tracking-tight leading-snug">My Attendance Logs</h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Review detailed, chronologically generated logs with automated presence assessments and download corporate spreadsheets.
          </p>
        </div>

        {/* Month Selection controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative shrink-0">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                }
              }}
              className="appearance-none border border-slate-200 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
          </div>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV report</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric Card 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400 block">Total WorkDays</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{totalDaysInSelection}</span>
            <span className="text-[10px] text-slate-400 font-medium">days in selection</span>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-emerald-600 block">Days Present</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-650 tracking-tight">{presentDaysCount}</span>
            <span className="text-[10px] text-emerald-500 font-bold">({totalDaysInSelection > 0 ? Math.round((presentDaysCount / totalDaysInSelection) * 100) : 0}%) Attendance rate</span>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-rose-500 block">Days Absent</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-650 tracking-tight">{absentDaysCount}</span>
            <span className="text-[10px] text-rose-450 font-bold">days missed</span>
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-indigo-500 block">Log Book hours</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-650 tracking-tight">{sumWorkHours.toFixed(1)}h</span>
            <span className="text-[10px] text-slate-400 font-medium">total work timed</span>
          </div>
        </div>
      </div>

      {/* Date-wise Table Sheet Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        {/* Filter controls bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <span className="font-extrabold text-slate-700 font-mono uppercase tracking-wider">
            Daily logs: {selectedMonth}
          </span>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Filter view:</span>
            <div className="flex space-x-1.5 bg-slate-200/50 p-1 rounded-lg">
              {(['All', 'Present', 'Absent', 'Weekly Off'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setFilterType(option)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    filterType === option 
                      ? 'bg-white text-indigo-600 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table itself */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest select-none">
                <th className="py-3 px-6">Calendar Date</th>
                <th className="py-3 px-6">Attendance assessment</th>
                <th className="py-3 px-4">Punch In</th>
                <th className="py-3 px-4">Lunch Breakout</th>
                <th className="py-3 px-4">Lunch return</th>
                <th className="py-3 px-4">Punch Out</th>
                <th className="py-3 px-4">Total clocked hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <Search className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                      <p className="font-bold text-slate-805">No matches found</p>
                      <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                        Try changing your Filter View or pick a different Month input above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let statusBadgeStyle = '';
                  let statusLabel = '';
                  let StatusIcon = CheckCircle;

                  if (log.status === 'Present') {
                    statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100/60';
                    statusLabel = 'Present';
                    StatusIcon = CheckCircle;
                  } else if (log.status === 'Late Entry') {
                    statusBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-100/60 animate-pulse';
                    statusLabel = 'Late Entry';
                    StatusIcon = AlertCircle;
                  } else if (log.status === 'Night Shift') {
                    statusBadgeStyle = 'bg-sky-50 text-sky-700 border-sky-100/60';
                    statusLabel = 'Night Shift';
                    StatusIcon = Clock;
                  } else if (log.status === 'Weekly Off') {
                    statusBadgeStyle = 'bg-slate-100 text-slate-400 border-slate-200/50';
                    statusLabel = 'Weekly Off';
                    StatusIcon = Coffee;
                  } else if (log.status === 'Pending') {
                    statusBadgeStyle = 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse';
                    statusLabel = 'Awaiting Punch';
                    StatusIcon = Clock;
                  } else {
                    // Absent
                    statusBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-100';
                    statusLabel = 'Absent';
                    StatusIcon = XCircle;
                  }

                  return (
                    <tr 
                      key={log.dateString} 
                      className={`hover:bg-slate-50/50 border-slate-50 transition-colors ${
                        log.isWeekend ? 'bg-slate-50/20' : ''
                      }`}
                    >
                      {/* Date details */}
                      <td className="py-3 px-6 h-12">
                        <div className="flex items-center space-x-1">
                          <span className="font-extrabold text-slate-800">{log.formattedDate}</span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-100 px-1 rounded">
                            {log.dayLabel}
                          </span>
                        </div>
                      </td>

                      {/* Status indicator assessment */}
                      <td className="py-3 px-6 h-12">
                        <span className={`inline-flex items-center gap-1 border text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${statusBadgeStyle}`}>
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          <span>{statusLabel}</span>
                        </span>
                      </td>

                      {/* Clock details */}
                      <td className={`py-3 px-4 font-mono font-bold text-slate-650 h-12`}>
                        {log.clockIn}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 h-12">
                        {log.lunchOut}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 h-12">
                        {log.lunchIn}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-650 h-12">
                        {log.clockOut}
                      </td>

                      {/* Log Hours */}
                      <td className="py-3 px-4 h-12">
                        {log.hours > 0 ? (
                          <div className="flex items-center space-x-1">
                            <span className="font-mono font-bold text-slate-805 bg-indigo-50/30 text-indigo-755 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {log.hours.toFixed(2)} hrs
                            </span>
                            {log.overtime > 0 && (
                              <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                (+{log.overtime.toFixed(1)} OT)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-slate-350">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
