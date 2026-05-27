import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Calendar as CalendarIcon, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Coffee,
  Search,
  Filter,
  ArrowLeft,
  Camera,
  Layers,
  List,
  Upload,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wallet,
  TrendingUp
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Settings } from '../types';
import { calculateEarnings } from '../utils/calculations';

interface MyAttendanceViewProps {
  loggedInEmployee: Employee;
  attendance: AttendanceRecord[];
  onNavigateToView?: (view: string) => void;
  onUpdateEmployee?: (employee: Employee) => void;
  settings?: Settings;
}

export default function MyAttendanceView({
  loggedInEmployee,
  attendance,
  onNavigateToView,
  onUpdateEmployee,
  settings
}: MyAttendanceViewProps) {
  // Toggle states
  const [viewType, setViewType] = useState<'calendar' | 'table'>('calendar');
  
  // Current month state format: 'YYYY-MM'
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const defaultMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr);
  const [filterType, setFilterType] = useState<'All' | 'Present' | 'Absent' | 'Weekly Off'>('All');
  const [uploadError, setUploadError] = useState('');

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

  // Parse calendar structure for visual month grid
  const getCalendarDays = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 6 is Saturday
    
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    
    const cells: (Date | null)[] = [];
    
    // Add null cell spacers for preceding month offset
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    
    // Add real dates
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(year, month - 1, d));
    }
    
    return cells;
  };

  const calendarDays = getCalendarDays(selectedMonth);

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
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; 

    let status: 'Present' | 'Absent' | 'Weekly Off' | 'Late Entry' | 'Night Shift' | 'On Leave' | 'Pending' | 'Future' = 'Absent';
    let detail = matchedRecord;

    if (isFuture) {
      status = 'Future';
    } else if (matchedRecord) {
      if (matchedRecord.status && matchedRecord.status.toLowerCase().includes('leave')) {
        status = 'On Leave';
      } else if (matchedRecord.status === 'Late Entry') {
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
      overtime: detail?.overtime || 0,
      notes: detail?.notes,
      rawRecord: detail
    };
  });

  // Filter logs based on dropdown search
  const filteredLogs = processedLogs.filter(log => {
    if (log.status === 'Future') return false; 
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

  // Profile Image Base64 Uploader Handler
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setUploadError('File size exceeds 2.5MB. Please choose a smaller profile photo.');
      setTimeout(() => setUploadError(''), 6000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && onUpdateEmployee) {
        onUpdateEmployee({
          ...loggedInEmployee,
          photoUrl: reader.result
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Compute metrics for selected month
  const totalDaysInSelection = processedLogs.filter(l => l.status !== 'Future').length;
  const presentDaysCount = processedLogs.filter(l => ['Present', 'Late Entry', 'Night Shift'].includes(l.status)).length;
  const absentDaysCount = processedLogs.filter(l => l.status === 'Absent').length;
  const leavesCount = processedLogs.filter(l => l.status === 'On Leave').length;
  const sumWorkHours = processedLogs.reduce((acc, current) => acc + current.hours, 0);

  // Compute earnings and details for Monthly Payroll Summary Card
  const currentCurrency = settings?.currency || 'INR';
  const currencySymbol = currentCurrency === 'USD' ? '$' : currentCurrency === 'INR' ? '₹' : currentCurrency === 'EUR' ? '€' : currentCurrency === 'GBP' ? '£' : currentCurrency + ' ';

  const totalOvertimeHours = processedLogs.reduce((acc, curr) => acc + curr.overtime, 0);
  const totalStandardHours = Math.max(0, sumWorkHours - totalOvertimeHours);

  const { regularPay, overtimePay, totalPay } = calculateEarnings(
    sumWorkHours,
    totalOvertimeHours,
    loggedInEmployee.hourlyRate,
    settings?.overtimeRateMultiplier || 1.5
  );

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
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/95 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Punch Card
            </button>
            <button
              onClick={() => onNavigateToView('leaves')}
              className="text-[10px] font-bold text-slate-650 hover:bg-slate-100/95 hover:text-indigo-650 px-2.5 py-1.5 rounded-lg border border-slate-100 transition-all cursor-pointer font-sans"
            >
              My Leave Requests
            </button>
          </div>
        </div>
      )}

      {/* Bento Grid Header Layout: Corporate ID Card & Section Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left: ID Card Widget & Profile Photo Upload */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 sm:p-6 rounded-2xl text-white shadow-md border border-slate-800 flex flex-col justify-between relative overflow-hidden select-none">
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-indigo-500/10 blur-xl"></div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">
                Corporate ID Badge
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full font-mono uppercase animate-pulse">
                Active Session
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Photo Upload Container */}
              <div className="relative group shrink-0">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-950/40 flex items-center justify-center relative shadow">
                  {loggedInEmployee.photoUrl ? (
                    <img 
                      src={loggedInEmployee.photoUrl} 
                      alt={loggedInEmployee.name} 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-500 stroke-1" />
                  )}
                  
                  {/* Camera overlay hover button */}
                  <label 
                    htmlFor="profile-badge-pic-uploader"
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[8px] font-extrabold cursor-pointer uppercase text-white font-sans text-center px-1"
                  >
                    <Camera className="w-4 h-4 text-white mb-0.5" />
                    <span>Upload</span>
                  </label>
                </div>
                
                <input 
                  type="file" 
                  id="profile-badge-pic-uploader"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden" 
                />
              </div>

              {/* ID Details */}
              <div className="space-y-0.5 sm:space-y-1">
                <h3 className="text-sm font-black tracking-tight text-white">{loggedInEmployee.name}</h3>
                <p className="text-2xs text-slate-350 font-mono">{loggedInEmployee.id} • {loggedInEmployee.department}</p>
                <div className="text-[10px] text-slate-400">
                  <span className="font-mono">Joined:</span> <span>{loggedInEmployee.joinedDate}</span>
                </div>
              </div>
            </div>

            {uploadError && (
              <p className="text-[10px] text-rose-400 font-medium font-mono">
                ⚠ {uploadError}
              </p>
            )}
          </div>

          <div className="pt-3 sm:pt-4 border-t border-slate-850 mt-4 flex items-center justify-between text-2xs text-slate-400 font-mono">
            <span>Email Status:</span>
            <span className="text-indigo-200 truncate max-w-[150px] font-sans">{loggedInEmployee.email}</span>
          </div>
        </div>

        {/* Right 2 Cols: Month pickers & Description summary */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-3xs flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="bg-indigo-50 text-indigo-700 p-2 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest leading-none block">Personal Board</span>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">My Attendance Statement</h1>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Review personal calendar boards and logs. Change your profile badge photo, examine monthly ratios of punch-ins, clock out margins, and export standard CSV spreadsheets.
            </p>
          </div>

          {/* Month Selection and Download Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-50 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative shrink-0 w-full sm:w-auto">
                <CalendarIcon className="w-4 h-4 text-slate-450 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedMonth(e.target.value);
                    }
                  }}
                  className="appearance-none border border-slate-200 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 bg-slate-50 cursor-pointer w-full sm:w-auto"
                />
              </div>

              {/* View Switcher: Calendar vs Table list */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-150/40 w-full sm:w-fit justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => setViewType('calendar')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    viewType === 'calendar' 
                      ? 'bg-white text-indigo-700 shadow-2xs' 
                      : 'text-slate-550 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Calendar Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('table')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    viewType === 'table' 
                      ? 'bg-white text-indigo-700 shadow-2xs' 
                      : 'text-slate-550 hover:text-slate-800'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Detailed Sheet</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Report</span>
            </button>
          </div>
        </div>

      </div>

      {/* Metrics Summary Panels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-1 sm:space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400 block">Total Workdays</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{totalDaysInSelection}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium whitespace-nowrap">days logged</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-emerald-50 shadow-2xs space-y-1 sm:space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-emerald-600 block">Days Present</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">{presentDaysCount}</span>
            <span className="text-[9px] sm:text-[10px] text-emerald-500 font-semibold font-mono">({totalDaysInSelection > 0 ? Math.round((presentDaysCount / totalDaysInSelection) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-50 shadow-2xs space-y-1 sm:space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-rose-500 block">Days Absent</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-black text-rose-650 tracking-tight">{absentDaysCount}</span>
            <span className="text-[9px] sm:text-[10px] text-rose-450 font-bold whitespace-nowrap">{leavesCount} leave</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-indigo-50 shadow-2xs space-y-1 sm:space-y-2">
          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-indigo-500 block">Log Book Hours</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-black text-indigo-650 tracking-tight">{sumWorkHours.toFixed(1)}h</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium font-mono">accumulated</span>
          </div>
        </div>
      </div>

      {/* CORE DISPLAY SWITCH: Calendar View vs Table View */}
      {viewType === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-150/50 pb-3 gap-3">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <span>Sheet: <span className="text-indigo-650 font-bold">{selectedMonth}</span></span>
            </h3>

            {/* Quick Status Legends */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-3xs font-bold leading-none select-none">
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-emerald-150 border border-emerald-300 text-emerald-850 flex items-center justify-center font-mono text-[9px] font-black">P</span>
                <span className="text-slate-500 font-sans uppercase">Present</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-mono text-[9px] font-black">L</span>
                <span className="text-slate-500 font-sans uppercase">Late Entry</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-sky-100 border border-sky-300 text-sky-850 flex items-center justify-center font-mono text-[9px] font-black">N</span>
                <span className="text-slate-500 font-sans uppercase">Night Shift</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-rose-150 border border-rose-350 text-rose-800 flex items-center justify-center font-mono text-[9px] font-black">A</span>
                <span className="text-slate-500 font-sans uppercase">Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-teal-100 border border-teal-300 text-teal-800 flex items-center justify-center font-mono text-[9px] font-black">OL</span>
                <span className="text-slate-500 font-sans uppercase">Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-md bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center font-mono text-[9px] font-black">WO</span>
                <span className="text-slate-500 font-sans uppercase">Off</span>
              </div>
            </div>
          </div>

          {/* Grid Layout definition */}
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
            <div className="w-[660px] sm:w-full">
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* Calendar Weekday titles */}
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
              <div key={day} className="text-center py-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 3)}</span>
              </div>
            ))}

            {/* Render padded spaces & real day blocks */}
            {calendarDays.map((cellDate, idx) => {
              if (cellDate === null) {
                return (
                  <div 
                    key={`empty-${idx}`} 
                    className="min-h-[48px] sm:min-h-[74px] bg-slate-50/20 rounded-lg border border-dashed border-slate-100/60"
                  />
                );
              }

              const dateNum = cellDate.getDate();
              const year = cellDate.getFullYear();
              const month = String(cellDate.getMonth() + 1).padStart(2, '0');
              const dayStr = String(dateNum).padStart(2, '0');
              const dateStringVal = `${year}-${month}-${dayStr}`;

              // Match processed log details
              const logMatch = processedLogs.find(l => l.dateString === dateStringVal);
              const isToday = new Date().toISOString().split('T')[0] === dateStringVal;

              // Styles map based on status
              let containerStyle = 'bg-white border-slate-150 text-slate-705';
              let badgeStyle = '';
              let badgeChar = '';

              if (logMatch) {
                switch (logMatch.status) {
                  case 'Present':
                    containerStyle = 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50';
                    badgeStyle = 'bg-emerald-600 text-white border-emerald-500 shadow-3xs';
                    badgeChar = 'P';
                    break;
                  case 'Late Entry':
                    containerStyle = 'bg-amber-50/40 border-amber-205 hover:bg-amber-55';
                    badgeStyle = 'bg-amber-500 text-white border-amber-450';
                    badgeChar = 'L';
                    break;
                  case 'Night Shift':
                    containerStyle = 'bg-sky-50/40 border-sky-200 hover:bg-sky-50';
                    badgeStyle = 'bg-sky-650 text-white border-sky-600';
                    badgeChar = 'N';
                    break;
                  case 'Weekly Off':
                    containerStyle = 'bg-slate-50/60 border-slate-150 text-slate-400';
                    badgeStyle = 'bg-slate-205 text-slate-500 border-slate-300';
                    badgeChar = 'WO';
                    break;
                  case 'On Leave':
                    containerStyle = 'bg-teal-50/40 border-teal-200 text-teal-700 hover:bg-teal-50';
                    badgeStyle = 'bg-teal-600 text-white border-teal-500';
                    badgeChar = 'OL';
                    break;
                  case 'Pending':
                    containerStyle = 'bg-indigo-50/20 border-indigo-150 shadow-3xs border-dashed text-slate-400';
                    badgeStyle = 'bg-indigo-100 text-indigo-750 font-medium text-[8px] tracking-tight p-0.5';
                    badgeChar = 'Awaiting';
                    break;
                  case 'Future':
                    containerStyle = 'bg-slate-50/20 border-slate-100 text-slate-300';
                    badgeStyle = '';
                    badgeChar = '';
                    break;
                  default: // Absent
                    containerStyle = 'bg-rose-50/30 border-rose-150 hover:bg-rose-50';
                    badgeStyle = 'bg-rose-600 text-white border-rose-505 font-black shrink-0';
                    badgeChar = 'A';
                    break;
                }
              }

              return (
                <div 
                  key={dateStringVal}
                  className={`min-h-[48px] sm:min-h-[74px] p-1 sm:p-1.5 rounded-lg border flex flex-col justify-between transition-all hover:shadow-3xs group ${containerStyle} ${
                    isToday ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] sm:text-[10px] font-black tracking-tight ${isToday ? 'text-indigo-650 font-black font-mono' : 'text-slate-800'}`}>
                      {dateNum}
                      {isToday && <span className="text-[6px] text-indigo-655 uppercase ml-0.5 hidden sm:inline-block font-bold">Today</span>}
                    </span>
                    {badgeChar && (
                      <span className={`inline-flex h-3.5 sm:h-4.5 items-center justify-center text-[7.5px] sm:text-[8.5px] font-black rounded border px-0.5 sm:px-1 uppercase leading-none font-mono ${badgeStyle}`}>
                        {badgeChar}
                      </span>
                    )}
                  </div>

                  {logMatch && logMatch.status !== 'Future' && logMatch.status !== 'Weekly Off' && logMatch.status !== 'On Leave' && (
                    <div className="mt-1 space-y-0.5 select-none font-mono text-[8px] sm:text-[8.5px] text-slate-550 flex flex-col">
                      {logMatch.hours > 0 ? (
                        <>
                          {/* Desktop details view */}
                          <div className="hidden sm:flex flex-col space-y-0.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1 truncate">
                              In: {logMatch.clockIn}
                              {(logMatch.rawRecord?.locationIn || logMatch.rawRecord?.locationEntry2) && (
                                <a
                                  href={`https://www.google.com/maps?q=${logMatch.rawRecord.locationIn || logMatch.rawRecord.locationEntry2}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[7.5px] text-teal-605 bg-teal-50 hover:bg-teal-100 border border-teal-150 px-0.5 rounded transition-colors shrink-0 font-medium"
                                  title="Verify GPS Location"
                                >
                                  <MapPin className="w-2 h-2" />
                                </a>
                              )}
                            </span>
                            <span className="font-bold text-slate-700 flex items-center gap-1 truncate">
                              Out: {logMatch.clockOut}
                              {(logMatch.rawRecord?.locationOut || logMatch.rawRecord?.locationExit2) && (
                                <a
                                  href={`https://www.google.com/maps?q=${logMatch.rawRecord.locationOut || logMatch.rawRecord.locationExit2}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[7.5px] text-teal-610 bg-teal-50 hover:bg-teal-100 border border-teal-150 px-0.5 rounded transition-colors shrink-0 font-medium"
                                  title="Verify GPS Location"
                                >
                                  <MapPin className="w-2 h-2" />
                                </a>
                              )}
                            </span>
                          </div>

                          {/* Mobile compact labels */}
                          <div className="flex sm:hidden flex-col text-[7.5px] font-bold text-slate-700 space-y-0.5">
                            <span className="truncate">
                              I: {logMatch.clockIn}
                            </span>
                            <span className="truncate">
                              O: {logMatch.clockOut}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-indigo-655 font-extrabold font-mono text-[7.5px] sm:text-[8.5px] leading-none shrink-0">{logMatch.hours.toFixed(1)} hrs</span>
                            {/* General Map Pin link on mobile */}
                            <span className="inline-flex sm:hidden">
                              {(logMatch.rawRecord?.locationIn || logMatch.rawRecord?.locationEntry2 || logMatch.rawRecord?.locationOut || logMatch.rawRecord?.locationExit2) && (
                                <a
                                  href={`https://www.google.com/maps?q=${logMatch.rawRecord.locationIn || logMatch.rawRecord.locationEntry2 || logMatch.rawRecord.locationOut || logMatch.rawRecord.locationExit2}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-605 bg-teal-50 hover:bg-teal-100 border border-teal-150 p-0.5 rounded shrink-0 transition-all scale-90"
                                  title="GPS Location Link"
                                >
                                  <MapPin className="w-1.5 h-1.5" />
                                </a>
                              )}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-350 italic text-[7px] sm:text-[7.5px] hidden sm:block">No clocks logged</span>
                      )}
                    </div>
                  )}

                  {logMatch && logMatch.status === 'Weekly Off' && (
                    <div className="text-[8.5px] sm:text-[9.5px] italic font-mono text-slate-400 font-bold flex items-center gap-0.5 hidden sm:flex">
                      <Coffee className="w-2.5 h-2.5 text-slate-405" />
                      <span>OFF DAY</span>
                    </div>
                  )}

                  {logMatch && logMatch.status === 'On Leave' && (
                    <div className="text-[8px] sm:text-[8.5px] uppercase tracking-wider font-mono text-teal-600 font-black hidden sm:block">
                      Excused Out
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TABLE VIEW FALLBACK LIST */
        <div className="space-y-6">
          {/* Monthly Payroll Summary Card */}
          <div className="bg-gradient-to-br from-slate-50 via-indigo-50/20 to-white border border-indigo-150/75 rounded-2xl p-5 sm:p-6 shadow-xs select-none animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100/60 pb-4 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Wallet className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-indigo-500 font-mono uppercase tracking-widest leading-none block">Corporate Billing Period</span>
                  <h3 className="text-sm font-black text-slate-850 tracking-tight leading-snug">Monthly Payroll Summary</h3>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white/80 border border-slate-150 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-slate-500 uppercase shadow-3xs select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Period: {selectedMonth}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Gross Salary Estimate Column */}
              <div className="bg-white border border-slate-150/80 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400 block mb-1">
                    Estimated Gross Pay
                  </span>
                  <div className="flex items-baseline text-indigo-650">
                    <span className="text-xl sm:text-2xl font-black tracking-tight font-sans">
                      {currencySymbol}{totalPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] font-mono font-bold ml-1 text-slate-400">
                      {currentCurrency}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-400 font-mono">
                  <span>Regular + OT Hours</span>
                  <span className="font-extrabold text-slate-650">{sumWorkHours.toFixed(2)} hrs</span>
                </div>
              </div>

              {/* Detail columns breakout: Regular Work */}
              <div className="bg-slate-50/55 border border-slate-150/60 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400 block">Standard Hours</span>
                    <span className="text-[8px] bg-slate-200 text-slate-500 font-bold px-1 py-0.5 rounded uppercase font-mono tracking-tight">1.0x Rate</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-lg sm:text-xl font-black text-slate-800 tracking-tight font-sans">{totalStandardHours.toFixed(2)}h</span>
                    <span className="text-[9px] text-slate-400 font-medium font-mono">logged</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between text-2xs text-slate-500 font-mono">
                  <span>Rate: {currencySymbol}{loggedInEmployee.hourlyRate.toFixed(2)}/hr</span>
                  <span className="font-extrabold text-slate-700">{currencySymbol}{regularPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Detail columns breakout: Overtime Premium */}
              <div className="bg-emerald-50/15 border border-emerald-100/50 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-emerald-600 block">Overtime Hours</span>
                    <span className="text-[8px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-tight">
                      {settings?.overtimeRateMultiplier || 1.5}x Multiplier
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight font-sans">{totalOvertimeHours.toFixed(2)}h</span>
                    <span className="text-[9px] text-emerald-500 font-bold font-mono">logged</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-emerald-100/60 flex items-center justify-between text-2xs text-slate-500 font-mono">
                  <span>OT Rate: {currencySymbol}{(loggedInEmployee.hourlyRate * (settings?.overtimeRateMultiplier || 1.5)).toFixed(2)}/hr</span>
                  <span className="font-extrabold text-emerald-600 font-sans">{currencySymbol}{overtimePay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Explanatory note banner */}
            <div className="mt-4 p-3.5 bg-indigo-50/45 border border-indigo-100/40 rounded-xl flex items-start gap-2.5 text-slate-500 text-2xs leading-relaxed font-sans">
              <span className="text-indigo-650 shrink-0 select-none text-[11px] font-bold">ℹ</span>
              <p>
                Estimated payroll details are aggregated for <span className="font-bold text-slate-700">{loggedInEmployee.name}</span> over the defined month. Exact corporate paychecks are verified server-side through leaves, monthly bonuses, global deductions, and tax compliance structures.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
          {/* Filter controls bar */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <span className="font-extrabold text-slate-700 font-mono uppercase tracking-wider">
              Daily Logs: {selectedMonth}
            </span>

            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Filter View:</span>
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
                  <th className="py-3 px-6">Attendance Assessment</th>
                  <th className="py-3 px-4">Punch In</th>
                  <th className="py-3 px-4">Lunch Breakout</th>
                  <th className="py-3 px-4">Lunch Return</th>
                  <th className="py-3 px-4">Punch Out</th>
                  <th className="py-3 px-4">Total Clocked Hours</th>
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
                      statusBadgeStyle = 'bg-emerald-55 text-emerald-755 border-emerald-150/60 font-black';
                      statusLabel = 'Present';
                      StatusIcon = CheckCircle;
                    } else if (log.status === 'Late Entry') {
                      statusBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-100/60 font-bold';
                      statusLabel = 'Late Entry';
                      StatusIcon = AlertCircle;
                    } else if (log.status === 'Night Shift') {
                      statusBadgeStyle = 'bg-sky-50 text-sky-700 border-sky-100/60 font-bold';
                      statusLabel = 'Night Shift';
                      StatusIcon = Clock;
                    } else if (log.status === 'Weekly Off') {
                      statusBadgeStyle = 'bg-slate-100 text-slate-400 border-slate-200/55 font-bold';
                      statusLabel = 'Weekly Off';
                      StatusIcon = Coffee;
                    } else if (log.status === 'On Leave') {
                      statusBadgeStyle = 'bg-teal-50 text-teal-700 border-teal-150/60 font-bold';
                      statusLabel = 'Excused Leave';
                      StatusIcon = Coffee;
                    } else if (log.status === 'Pending') {
                      statusBadgeStyle = 'bg-amber-50 text-amber-600 border-amber-100 font-bold animate-pulse';
                      statusLabel = 'Awaiting Punch';
                      StatusIcon = Clock;
                    } else {
                      // Absent
                      statusBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-100 font-black';
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
                            <span className="font-extrabold text-slate-805">{log.formattedDate}</span>
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
                        <td className="py-3 px-4 font-mono font-bold text-slate-650 h-12">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{log.clockIn}</span>
                            {(log.rawRecord?.locationIn || log.rawRecord?.locationEntry2) && (
                              <a
                                href={`https://www.google.com/maps?q=${log.rawRecord.locationIn || log.rawRecord.locationEntry2}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-100 transition-colors"
                                title="Verify GPS Location"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                <span>GPS</span>
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-500 h-12">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{log.lunchOut}</span>
                            {log.rawRecord?.locationLunchOut && (
                              <a
                                href={`https://www.google.com/maps?q=${log.rawRecord.locationLunchOut}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-100 transition-colors"
                                title="Lunch Out GPS"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-500 h-12">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{log.lunchIn}</span>
                            {log.rawRecord?.locationLunchIn && (
                              <a
                                href={`https://www.google.com/maps?q=${log.rawRecord.locationLunchIn}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-100 transition-colors"
                                title="Lunch In GPS"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-655 h-12">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{log.clockOut}</span>
                            {(log.rawRecord?.locationOut || log.rawRecord?.locationExit2) && (
                              <a
                                href={`https://www.google.com/maps?q=${log.rawRecord.locationOut || log.rawRecord.locationExit2}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-1 py-0.5 rounded border border-teal-100 transition-colors"
                                title="Verify GPS Location"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                <span>GPS</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Log Hours */}
                        <td className="py-3 px-4 h-12">
                          {log.hours > 0 ? (
                            <div className="flex items-center space-x-1">
                              <span className="font-mono font-bold text-slate-850 bg-indigo-50/30 text-indigo-755 border border-indigo-100 px-1.5 py-0.5 rounded">
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
      )}

    </div>
  );
}
