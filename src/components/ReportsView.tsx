import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  Search, 
  Filter, 
  IndianRupee, 
  TrendingUp, 
  Clock, 
  User, 
  Download,
  Receipt,
  DownloadCloud,
  Plus,
  Pencil,
  X
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';
import { calculateEarnings, calculateAttendanceMetrics } from '../utils/calculations';

interface ReportsViewProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  onAddAttendance: (record: AttendanceRecord) => void;
  onUpdateAttendance: (record: AttendanceRecord) => void;
}

export default function ReportsView({
  employees,
  attendance,
  settings,
  onAddAttendance,
  onUpdateAttendance,
}: ReportsViewProps) {
  // Filters states
  const [filterType, setFilterType] = useState<'daily' | 'weekly' | 'monthly' | 'employee' | 'custom'>('monthly');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  // Date selection states
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    // default to 14 days ago
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Manual add/edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  // Form fields
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEntryTime, setFormEntryTime] = useState('09:00');
  const [formLunchOut, setFormLunchOut] = useState('13:00');
  const [formLunchIn, setFormLunchIn] = useState('14:00');
  const [formExitTime, setFormExitTime] = useState('18:00');
  
  // Double shift form fields
  const [formHasShift2, setFormHasShift2] = useState(false);
  const [formEntryTime2, setFormEntryTime2] = useState('');
  const [formExitTime2, setFormExitTime2] = useState('');
  const [formDinnerOut, setFormDinnerOut] = useState('');
  const [formDinnerIn, setFormDinnerIn] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setModalMode('add');
    setSelectedRecordId(null);
    setFormEmployeeId(employees[0]?.id || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormEntryTime('09:00');
    setFormLunchOut('13:00');
    setFormLunchIn('14:00');
    setFormExitTime('18:00');
    setFormHasShift2(false);
    setFormEntryTime2('18:30');
    setFormExitTime2('22:00');
    setFormDinnerOut('');
    setFormDinnerIn('');
    setFormNotes('Manual entry by administrator');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setModalMode('edit');
    setSelectedRecordId(`${rec.date}_${rec.employeeId}`);
    setFormEmployeeId(rec.employeeId);
    setFormDate(rec.date);
    setFormEntryTime(rec.entryTime || '');
    setFormLunchOut(rec.lunchOut || '');
    setFormLunchIn(rec.lunchIn || '');
    setFormExitTime(rec.exitTime || '');
    
    const hasShift2 = !!rec.entryTime2;
    setFormHasShift2(hasShift2);
    setFormEntryTime2(rec.entryTime2 || '18:30');
    setFormExitTime2(rec.exitTime2 || '22:00');
    setFormDinnerOut(rec.dinnerOut || '');
    setFormDinnerIn(rec.dinnerIn || '');
    setFormNotes(rec.notes || 'Timecard override by admin');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSavePunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) {
      setFormError('Please select a valid employee.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }

    const emp = employees.find(e => e.id === formEmployeeId);
    if (!emp) {
      setFormError('Selected employee record not found.');
      return;
    }

    // Dynamic metrics computation
    const metrics = calculateAttendanceMetrics(
      formEntryTime,
      formExitTime,
      formLunchOut,
      formLunchIn,
      settings,
      formHasShift2 ? formEntryTime2 : '',
      formHasShift2 ? formExitTime2 : '',
      formDinnerOut,
      formDinnerIn
    );

    const recordPayload: AttendanceRecord = {
      date: formDate,
      employeeId: formEmployeeId,
      employeeName: emp.name,
      entryTime: formEntryTime,
      lunchOut: formLunchOut,
      lunchIn: formLunchIn,
      exitTime: formExitTime,
      entryTime2: formHasShift2 ? formEntryTime2 : '',
      exitTime2: formHasShift2 ? formExitTime2 : '',
      dinnerOut: formDinnerOut,
      dinnerIn: formDinnerIn,
      totalHours: metrics.totalHours,
      overtime: metrics.overtime,
      status: metrics.statusFlags.join(', ') || 'Present',
      notes: formNotes || `${modalMode === 'add' ? 'Manual entry' : 'Manually edited'} by administrator`,
    };

    if (modalMode === 'add') {
      onAddAttendance(recordPayload);
    } else {
      onUpdateAttendance(recordPayload);
    }

    setIsModalOpen(false);
  };

  // Calculations range selector logic
  const getFilteredRecords = (): AttendanceRecord[] => {
    const today = new Date();
    
    return attendance.filter((rec) => {
      const recDate = new Date(rec.date);
      
      if (filterType === 'daily') {
        return rec.date === singleDate;
      }
      
      if (filterType === 'weekly') {
        // Log last 7 calendar days from today
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        return recDate >= sevenDaysAgo && recDate <= today;
      }
      
      if (filterType === 'monthly') {
        // Log current calendar month (e.g. "2026-05")
        const currentMonthPrefix = singleDate.slice(0, 7); // YYYY-MM
        return rec.date.startsWith(currentMonthPrefix);
      }
      
      if (filterType === 'employee') {
        if (!selectedEmployeeId) return true; // show all if none chosen
        return rec.employeeId === selectedEmployeeId;
      }
      
      if (filterType === 'custom') {
        return rec.date >= startDate && rec.date <= endDate;
      }
      
      return true;
    });
  };

  const filteredRecords = getFilteredRecords().sort((a,b) => b.date.localeCompare(a.date));

  // Compute aggregate statistics for payroll summary
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  let totalWagesPaid = 0;
  let totalOvertimePaid = 0;
  let presentDaysCount = 0;
  let lateEntriesCount = 0;

  filteredRecords.forEach((rec) => {
    const emp = employees.find((e) => e.id === rec.employeeId);
    const hourlyRate = emp ? emp.hourlyRate : 25; // default rate lookup

    totalWorkHours += rec.totalHours || 0;
    totalOvertimeHours += rec.overtime || 0;

    const { regularPay, overtimePay } = calculateEarnings(
      rec.totalHours || 0,
      rec.overtime || 0,
      hourlyRate,
      settings.overtimeRateMultiplier
    );

    totalWagesPaid += regularPay;
    totalOvertimePaid += overtimePay;
    
    if (rec.entryTime) presentDaysCount += 1;
    if (rec.status.includes('Late Entry')) lateEntriesCount += 1;
  });

  const grandTotalPay = totalWagesPaid + totalOvertimePaid;

  // EXPORT EXCEL (CSV implementation)
  const handleExportToExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header Row matching attendance structure
    csvContent += 'Date,Employee ID,Employee Name,Entry Time,Lunch Out,Lunch In,Exit Time,Total Hours,Overtime,Status,Hourly Rate,Total Earnings\n';
    
    filteredRecords.forEach((rec) => {
      const emp = employees.find((e) => e.id === rec.employeeId);
      const rate = emp ? emp.hourlyRate : 20;
      const earnings = calculateEarnings(rec.totalHours, rec.overtime, rate, settings.overtimeRateMultiplier);
      
      const row = [
        rec.date,
        rec.employeeId,
        `"${rec.employeeName.replace(/"/g, '""')}"`,
        rec.entryTime || '--:--',
        rec.lunchOut || '--:--',
        rec.lunchIn || '--:--',
        rec.exitTime || '--:--',
        rec.totalHours || 0,
        rec.overtime || 0,
        `"${rec.status}"`,
        rate,
        earnings.totalPay.toFixed(2)
      ].join(',');
      
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${filterType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT PDF via window.print CSS print styles
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="reports-view-container">
      {/* Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Financial & Attendance Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track daily worklogs, compute payroll wages, separate overtime rewards and export sheets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            id="btn-add-manual-punch"
            className="flex items-center space-x-1 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-emerald-500/15 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-100 shrink-0" />
            <span>Manually Add Missed Punch</span>
          </button>
          <button
            onClick={handleExportToExcel}
            id="btn-export-excel"
            className="flex items-center space-x-1 px-3.5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            <DownloadCloud className="w-4 h-4 text-slate-450 shrink-0" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            onClick={handlePrintPDF}
            id="btn-export-pdf"
            className="flex items-center space-x-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-semibold cursor-pointer shadow-sm shadow-indigo-600/10 transition-colors"
          >
            <Printer className="w-4 h-4 text-indigo-200 shrink-0" />
            <span>Export / Print PDF</span>
          </button>
        </div>
      </div>

      {/* Prints Layout Header (Only visible on web print view) All styles wrapped in standard tailwind print clauses */}
      <div className="hidden print:block border-b border-slate-300 pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{settings.companyName} Logs</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">TIMECARD & PAYROLL AUDIT SUMMARY</p>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            <p>Export Date: {new Date().toLocaleDateString()}</p>
            <p className="uppercase">Period: {filterType} report</p>
          </div>
        </div>
      </div>

      {/* Reports control desk filters (Hidden during print logs) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 print:hidden">
        <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-100">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Report Categorization Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main category Selector */}
          <div>
            <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
              Report Frequency Mode
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 font-semibold rounded-xl text-xs text-slate-700"
            >
              <option value="daily">Daily report</option>
              <option value="weekly">Weekly report (last 7 days)</option>
              <option value="monthly">Monthly report</option>
              <option value="employee">Employee-wise report</option>
              <option value="custom">Date Range Custom Filter</option>
            </select>
          </div>

          {/* Dynamic contextual subfilters */}
          {filterType === 'daily' && (
            <div>
              <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
                Select Report Date
              </label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-700 font-mono"
              />
            </div>
          )}

          {filterType === 'monthly' && (
            <div>
              <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
                Select Core Month
              </label>
              <input
                type="month"
                value={singleDate.slice(0, 7)}
                onChange={(e) => setSingleDate(`${e.target.value}-01`)}
                className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-750 font-semibold font-mono"
              />
            </div>
          )}

          {filterType === 'employee' && (
            <div>
              <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
                Select Staff Profile
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 text-xs rounded-xl"
              >
                <option value="">-- Choose employee --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterType === 'custom' && (
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div>
                <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
                  From (Start Date)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block text-2xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 font-mono">
                  To (End Date)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-700 font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Payroll metrics summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Core Wages calculated */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-110/30">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0 font-sans">
            <span className="text-3xs font-mono uppercase tracking-widest text-slate-400 font-bold block">
              Core Shift Wages
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">
              ₹{totalWagesPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-3xs text-emerald-650 font-mono uppercase mt-1">
              Standard completed terms
            </p>
          </div>
        </div>

        {/* Overtime wages */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-indigo-50 text-indigo-650 p-3 rounded-xl border border-indigo-110/30">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-3xs font-mono uppercase tracking-widest text-slate-400 font-bold block">
              Overtime Bonuses
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">
              ₹{totalOvertimePaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-3xs text-indigo-600 font-mono uppercase font-semibold mt-1">
              At {settings.overtimeRateMultiplier}x premium multiplier
            </p>
          </div>
        </div>

        {/* Aggregate hours */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-slate-50 text-slate-650 p-3 rounded-xl border border-slate-200">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-3xs font-mono uppercase tracking-widest text-slate-400 font-bold block">
              Total Hours Worked
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">
              {totalWorkHours.toFixed(2)}h
            </span>
            <p className="text-3xs text-slate-500 font-mono mt-1">
              {totalOvertimeHours.toFixed(2)}h OVERTIME INCLUDED
            </p>
          </div>
        </div>

        {/* Grand Total Payroll budget */}
        <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-600/10 flex items-center space-x-4">
          <div className="bg-white/10 text-white p-3 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-3xs font-mono uppercase tracking-widest text-indigo-200 font-bold block">
              Cumulative Expense
            </span>
            <span className="text-2xl font-black mt-0.5 block">
              ₹{grandTotalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-3xs text-indigo-150 font-mono uppercase mt-1">
              Net payout amount
            </p>
          </div>
        </div>
      </div>

      {/* Main logs items table list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between text-slate-800">
          <div>
            <h3 className="text-sm font-bold">Timecard & Wage Breakdown</h3>
            <p className="text-3xs text-slate-400 font-mono uppercase mt-0.5">
              Compiled results showing {filteredRecords.length} records matching guidelines
            </p>
          </div>
          <span className="text-3xs font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-1 rounded border">
            {presentDaysCount} Presence shifts recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-450 font-bold text-[10px] uppercase font-mono tracking-wider">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Staff ID & Name</th>
                <th className="py-3 px-4">Time Logs (In/Out)</th>
                <th className="py-3 px-4 text-center">Standard Shift</th>
                <th className="py-3 px-4 text-center">Overtime</th>
                <th className="py-3 px-4 text-center font-mono">Hourly Rate</th>
                <th className="py-3 px-6 text-right">Computed Pay</th>
                <th className="py-3 px-6 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-750 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-2xs font-mono">
                    No active attendance sheets found within specified calendar filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const emp = employees.find((e) => e.id === rec.employeeId);
                  const rate = emp ? emp.hourlyRate : 25;
                  
                  const earnings = calculateEarnings(
                    rec.totalHours || 0,
                    rec.overtime || 0,
                    rate,
                    settings.overtimeRateMultiplier
                  );

                  return (
                    <tr key={`${rec.employeeId}-${rec.date}`} className="hover:bg-slate-50/20">
                      <td className="py-3 px-6 font-mono font-semibold text-slate-600">
                        {rec.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold">{rec.employeeName}</span>
                          <span className="text-3xs font-mono text-slate-400 uppercase tracking-widest">{rec.employeeId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-2xs">
                        <div className="flex flex-col space-y-1">
                          <div className="space-x-1.5 flex flex-wrap">
                            <span>S1 In: <strong className="text-slate-900 font-bold">{rec.entryTime || '--:--'}</strong></span>
                            <span>S1 Out: <strong className="text-slate-900 font-bold">{rec.exitTime || '--:--'}</strong></span>
                          </div>
                          {rec.lunchOut && (
                            <span className="text-slate-400 text-[10px]">
                              Lunch Break: {rec.lunchOut} - {rec.lunchIn || 'Resting'}
                            </span>
                          )}
                          {rec.entryTime2 && (
                            <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5">
                              <div className="space-x-1.5 flex flex-wrap text-indigo-700 font-medium">
                                <span>S2 In: <strong className="font-bold">{rec.entryTime2}</strong></span>
                                <span>S2 Out: <strong className="font-bold">{rec.exitTime2 || '--:--'}</strong></span>
                              </div>
                              {rec.dinnerOut && (
                                <span className="text-rose-600 text-[10px] block">
                                  Dinner Break: {rec.dinnerOut} - {rec.dinnerIn || 'Resting'}
                                </span>
                              )}
                            </div>
                          )}
                          {!rec.entryTime2 && rec.dinnerOut && (
                            <span className="text-rose-600 text-[10px] block">
                              Dinner Break: {rec.dinnerOut} - {rec.dinnerIn || 'Resting'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-650">
                        {Math.max(0, rec.totalHours - rec.overtime).toFixed(2)} hrs
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-650 font-bold">
                        {rec.overtime > 0 ? `+${rec.overtime.toFixed(2)}h` : '--'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        ₹{rate}/hr
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        <div className="flex flex-col text-right">
                          <span>
                            ₹{earnings.totalPay.toFixed(2)}
                          </span>
                          {rec.overtime > 0 && (
                            <span className="text-[9px] text-indigo-550 font-semibold">
                              (incl. ₹{earnings.overtimePay.toFixed(2)} OT)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 rounded-lg transition-colors cursor-pointer"
                          title="Edit Missed Punch Log"
                        >
                          <Pencil className="w-2.5 h-2.5 shrink-0" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Punch Form Modal Dialog */}
      {isModalOpen && (
        <div id="manual-punch-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 relative space-y-4 max-h-[90vh] overflow-y-auto animate-scaleIn">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${modalMode === 'add' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                  <span>{modalMode === 'add' ? 'Manually Add Missed Punch' : 'Edit Missed Punch Log'}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {modalMode === 'add' ? 'Add missing attendance row record with custom times' : 'Modify registered time clock segments and update totals'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePunch} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-3xs font-mono">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee Selector */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-450 mb-1 font-mono">
                    Staff Member
                  </label>
                  <select
                    disabled={modalMode === 'edit'}
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/30 font-medium disabled:opacity-60 disabled:bg-slate-150"
                  >
                    <option value="">-- Choose employee --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Input */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-450 mb-1 font-mono">
                    Punch Date
                  </label>
                  <input
                    type="date"
                    disabled={modalMode === 'edit'}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/30 font-mono disabled:opacity-60 disabled:bg-slate-150"
                  />
                </div>
              </div>

              {/* Shift 1 Times */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-100 pb-1 font-mono">
                  Shift 1 Duration Parameters
                </span>

                <div className="grid grid-cols-2 gap-3 pb-1">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1 font-mono">
                      S1 In (Check-In)
                    </label>
                    <input
                      type="time"
                      value={formEntryTime}
                      onChange={(e) => setFormEntryTime(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1 font-mono">
                      S1 Out (Check-Out)
                    </label>
                    <input
                      type="time"
                      value={formExitTime}
                      onChange={(e) => setFormExitTime(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100/60">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1 font-mono">
                      S1 Lunch Out
                    </label>
                    <input
                      type="time"
                      value={formLunchOut}
                      onChange={(e) => setFormLunchOut(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1 font-mono">
                      S1 Lunch In
                    </label>
                    <input
                      type="time"
                      value={formLunchIn}
                      onChange={(e) => setFormLunchIn(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Shift 2 / Double Shift Toggle Checkbox */}
              <div className="flex items-center space-x-2 px-1">
                <input
                  type="checkbox"
                  id="formHasShift2"
                  checked={formHasShift2}
                  onChange={(e) => setFormHasShift2(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="formHasShift2" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Include Double Shift (Shift 2) Parameters
                </label>
              </div>

              {/* Shift 2 Times */}
              {formHasShift2 && (
                <div className="border border-indigo-100 rounded-2xl p-4 bg-indigo-50/20 space-y-3 animate-fadeIn">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block border-b border-indigo-100/50 pb-1 font-mono">
                    Shift 2 (Double Shift) Parameters
                  </span>

                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-indigo-600 mb-1 font-mono">
                        S2 In (Check-In)
                      </label>
                      <input
                        type="time"
                        value={formEntryTime2}
                        onChange={(e) => setFormEntryTime2(e.target.value)}
                        className="w-full px-3 py-1.5 border border-indigo-200/50 bg-white text-xs rounded-lg focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-indigo-600 mb-1 font-mono">
                        S2 Out (Check-Out)
                      </label>
                      <input
                        type="time"
                        value={formExitTime2}
                        onChange={(e) => setFormExitTime2(e.target.value)}
                        className="w-full px-3 py-1.5 border border-indigo-200/50 bg-white text-xs rounded-lg focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-indigo-100/40">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-indigo-600 mb-1 font-mono">
                        Dinner Out (Break)
                      </label>
                      <input
                        type="time"
                        value={formDinnerOut}
                        onChange={(e) => setFormDinnerOut(e.target.value)}
                        className="w-full px-3 py-1.5 border border-indigo-200/50 bg-white text-xs rounded-lg focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-indigo-600 mb-1 font-mono">
                        Dinner In (Return)
                      </label>
                      <input
                        type="time"
                        value={formDinnerIn}
                        onChange={(e) => setFormDinnerIn(e.target.value)}
                        className="w-full px-3 py-1.5 border border-indigo-200/50 bg-white text-xs rounded-lg focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-450 mb-1 font-mono">
                  Administrative Notes / Overriding Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g., missed card swipe, swipe device connection failure"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 text-xs rounded-xl focus:outline-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-xs font-extrabold text-white rounded-xl shadow-lg cursor-pointer ${
                    modalMode === 'add' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                  }`}
                >
                  {modalMode === 'add' ? 'Save New Punch' : 'Update Punch Logs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
