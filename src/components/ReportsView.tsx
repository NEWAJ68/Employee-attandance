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
  X,
  Trash2,
  MapPin
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';
import { calculateEarnings, calculateAttendanceMetrics } from '../utils/calculations';

interface ReportsViewProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  onAddAttendance: (record: AttendanceRecord) => void;
  onUpdateAttendance: (record: AttendanceRecord) => void;
  onClearAttendance?: () => Promise<void>;
}

export default function ReportsView({
  employees,
  attendance,
  settings,
  onAddAttendance,
  onUpdateAttendance,
  onClearAttendance,
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

  // Clear confirmation state
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPayrollSummaryOpen, setIsPayrollSummaryOpen] = useState(false);
  const [isWagesLogPreviewOpen, setIsWagesLogPreviewOpen] = useState(false);
  
  // Custom interactive viewport/print zoom adjustment state
  const [tableZoom, setTableZoom] = useState<number>(100);

  const handleZoomChange = (dir: 'in' | 'out') => {
    const zoomSteps = [50, 60, 70, 75, 80, 85, 90, 95, 100, 105, 110, 120];
    const currentIndex = zoomSteps.indexOf(tableZoom);
    if (dir === 'in' && currentIndex < zoomSteps.length - 1) {
      setTableZoom(zoomSteps[currentIndex + 1]);
    } else if (dir === 'out' && currentIndex > 0) {
      setTableZoom(zoomSteps[currentIndex - 1]);
    }
  };
  
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

  const handlePerformClearAll = async () => {
    if (onClearAttendance) {
      setIsClearing(true);
      try {
        await onClearAttendance();
      } catch (err) {
        console.error(err);
      } finally {
        setIsClearing(false);
        setIsConfirmClearOpen(false);
      }
    }
  };

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

    const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
    const isUnderMinHours = (rec.totalHours || 0) < 3;
    const effectiveHours = (isIncomplete || isUnderMinHours) ? 0 : (rec.totalHours || 0);
    const effectiveOvertime = (isIncomplete || isUnderMinHours) ? 0 : (rec.overtime || 0);

    totalWorkHours += effectiveHours;
    totalOvertimeHours += effectiveOvertime;

    const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
    const { regularPay, overtimePay } = calculateEarnings(
      rec.totalHours || 0,
      rec.overtime || 0,
      hourlyRate,
      settings.overtimeRateMultiplier,
      isIncomplete,
      emp?.monthlySalary,
      isHalfDay
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
    csvContent += 'Date,Employee ID,Employee Name,Hourly Wage,Employee Address,Entry Time,Lunch Out,Lunch In,Exit Time,Total Hours,Overtime,Status,Total Earnings\n';
    
    filteredRecords.forEach((rec) => {
      const emp = employees.find((e) => e.id === rec.employeeId);
      const rate = emp ? emp.hourlyRate : 20;
      const addr = emp?.address ? `"${emp.address.replace(/"/g, '""')}"` : '""';
      const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
      const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
      const earnings = calculateEarnings(
        rec.totalHours, 
        rec.overtime, 
        rate, 
        settings.overtimeRateMultiplier, 
        isIncomplete,
        emp?.monthlySalary,
        isHalfDay
      );
      
      const row = [
        rec.date,
        rec.employeeId,
        `"${rec.employeeName.replace(/"/g, '""')}"`,
        rate,
        addr,
        rec.entryTime || '--:--',
        rec.lunchOut || '--:--',
        rec.lunchIn || '--:--',
        rec.exitTime || '--:--',
        rec.totalHours || 0,
        rec.overtime || 0,
        `"${rec.status}"`,
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

  // Group and compute employee-wise summaries for payroll summary PDF doc
  const employeePayrollSummaries = employees.map(emp => {
    const empRecords = filteredRecords.filter(rec => rec.employeeId === emp.id);
    let totalHours = 0;
    let overtimeHours = 0;
    let regularPay = 0;
    let overtimePay = 0;

    empRecords.forEach(rec => {
      const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
      const isUnderMinHours = (rec.totalHours || 0) < 3;
      const effectiveHours = (isIncomplete || isUnderMinHours) ? 0 : (rec.totalHours || 0);
      const effectiveOvertime = (isIncomplete || isUnderMinHours) ? 0 : (rec.overtime || 0);

      totalHours += effectiveHours;
      overtimeHours += effectiveOvertime;
      const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
      const { regularPay: rp, overtimePay: op } = calculateEarnings(
        rec.totalHours || 0,
        rec.overtime || 0,
        emp.hourlyRate,
        settings.overtimeRateMultiplier,
        isIncomplete,
        emp.monthlySalary,
        isHalfDay
      );
      regularPay += rp;
      overtimePay += op;
    });

    const netPay = regularPay + overtimePay;

    return {
      employeeId: emp.id,
      name: emp.name,
      department: emp.department || 'General Services',
      hourlyRate: emp.hourlyRate,
      totalHours,
      overtimeHours,
      regularPay,
      overtimePay,
      netPay,
      recordCount: empRecords.length
    };
  }).filter(summary => summary.recordCount > 0);

  const grandSummaryWages = employeePayrollSummaries.reduce((sum, item) => sum + item.regularPay, 0);
  const grandSummaryOvertime = employeePayrollSummaries.reduce((sum, item) => sum + item.overtimePay, 0);
  const grandSummaryNetPay = employeePayrollSummaries.reduce((sum, item) => sum + item.netPay, 0);
  const grandSummaryHours = employeePayrollSummaries.reduce((sum, item) => sum + item.totalHours, 0);

  const activeEmployeeModel = filterType === 'employee' && selectedEmployeeId
    ? employees.find(e => e.id === selectedEmployeeId)
    : null;

  // EXPORT PDF via window.print CSS print styles
  const handlePrintPDF = () => {
    window.print();
  };

  // Standalone printable log generation for offline printing/PDF bypass
  const downloadFilteredLogsHTML = () => {
    const tableHeader = `
      <tr>
        <th style="padding: 10px 8px; text-align: left;">Date</th>
        <th style="padding: 10px 8px; text-align: left;">Emp ID</th>
        <th style="padding: 10px 8px; text-align: left;">Employee Name</th>
        <th style="padding: 10px 6px; text-align: center;">Entry Time</th>
        <th style="padding: 10px 6px; text-align: center;">Lunch Out</th>
        <th style="padding: 10px 6px; text-align: center;">Lunch In</th>
        <th style="padding: 10px 6px; text-align: center;">Exit Time</th>
        <th style="padding: 10px 6px; text-align: center;">Entry Time 2</th>
        <th style="padding: 10px 6px; text-align: center;">Dinner Out</th>
        <th style="padding: 10px 6px; text-align: center;">Dinner In</th>
        <th style="padding: 10px 6px; text-align: center;">Exit Time 2</th>
        <th style="padding: 10px 8px; text-align: center;">Work Hours</th>
        <th style="padding: 10px 8px; text-align: center;">Overtime</th>
        <th style="padding: 10px 8px; text-align: center;">Status</th>
        <th style="padding: 10px 8px; text-align: right;">Day Earnings</th>
      </tr>
    `;

    const tableRows = filteredRecords.length === 0
      ? `<tr><td colspan="15" style="padding: 32px; text-align: center; color: #94a3b8; font-family: monospace;">No attendance log entries matched current filters.</td></tr>`
      : filteredRecords.map((rec) => {
          const emp = employees.find((e) => e.id === rec.employeeId);
          const rate = emp?.hourlyRate || 25;
          const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
          const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
          const earnings = calculateEarnings(
            rec.totalHours, 
            rec.overtime, 
            rate, 
            settings.overtimeRateMultiplier, 
            isIncomplete,
            emp?.monthlySalary,
            isHalfDay
          );
          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 8px; font-weight: 500; font-family: monospace; color: #334155;">${rec.date}</td>
              <td style="padding: 10px 8px; font-family: monospace; color: #64748b;">${rec.employeeId}</td>
              <td style="padding: 10px 8px; font-weight: bold; color: #0f172a;">${rec.employeeName}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace;">${rec.entryTime || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #64748b;">${rec.lunchOut || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #64748b;">${rec.lunchIn || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace;">${rec.exitTime || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #4f46e5;">${rec.entryTime2 || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #b91c1c;">${rec.dinnerOut || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #b91c1c;">${rec.dinnerIn || '--:--'}</td>
              <td style="padding: 10px 6px; text-align: center; font-family: monospace; color: #4f46e5;">${rec.exitTime2 || '--:--'}</td>
              <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${(rec.totalHours || 0).toFixed(2)}h</td>
              <td style="padding: 10px 8px; text-align: center; font-weight: 600; color: #4f46e5;">${(rec.overtime || 0).toFixed(2)}h</td>
              <td style="padding: 10px 12px; text-align: center;">
                <span style="font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${
                  rec.status.includes('2nd Shift') ? '#f3e8ff; color: #6b21a8;' :
                  rec.status.includes('Half Day') ? '#fef3c7; color: #b45309;' :
                  rec.status.includes('Present') ? '#f0fdf4; color: #166534;' :
                  rec.status.includes('Late') ? '#fef9c3; color: #854d0e;' :
                  rec.status === 'Overtime' ? '#e0e7ff; color: #3730a3;' :
                  '#fef2f2; color: #991b1b;'
                }">${rec.status}</span>
              </td>
              <td style="padding: 10px 12px; text-align: right; font-weight: bold; font-family: monospace;">₹${earnings.totalPay.toFixed(2)}</td>
            </tr>
          `;
        }).join('');

    const totalHoursAgg = filteredRecords.reduce((sum, r) => {
      const isIncomplete = !!((r.entryTime && !r.exitTime) || (r.entryTime2 && !r.exitTime2));
      const isUnderMinHours = (r.totalHours || 0) < 3;
      if (isIncomplete || isUnderMinHours) return sum;
      return sum + (r.totalHours || 0);
    }, 0);
    const totalOTAgg = filteredRecords.reduce((sum, r) => {
      const isIncomplete = !!((r.entryTime && !r.exitTime) || (r.entryTime2 && !r.exitTime2));
      const isUnderMinHours = (r.totalHours || 0) < 3;
      if (isIncomplete || isUnderMinHours) return sum;
      return sum + (r.overtime || 0);
    }, 0);
    const totalPayAgg = filteredRecords.reduce((sum, r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      const rate = emp?.hourlyRate || 25;
      const isIncomplete = !!((r.entryTime && !r.exitTime) || (r.entryTime2 && !r.exitTime2));
      const isHalfDay = r.status ? r.status.includes('Half Day') : false;
      return sum + calculateEarnings(
        r.totalHours, 
        r.overtime, 
        rate, 
        settings.overtimeRateMultiplier, 
        isIncomplete,
        emp?.monthlySalary,
        isHalfDay
      ).totalPay;
    }, 0);

    const activeEmpDetails = activeEmployeeModel ? `
      <div style="margin-bottom: 24px; padding: 16px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 12px; font-size: 11px;">
        <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold; color: #4338ca;">Audited Staff Record</span>
        <h2 style="font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 4px 0 8px 0;">${activeEmployeeModel.name} (ID: ${activeEmployeeModel.id})</h2>
        <p style="margin: 2px 0;"><strong>Department:</strong> ${activeEmployeeModel.department} &bull; <strong>Work Email:</strong> ${activeEmployeeModel.email}</p>
        <p style="margin: 2px 0;"><strong>Residential Address (पता):</strong> ${activeEmployeeModel.address || "No address details registered."}</p>
        <p style="margin: 2px 0;"><strong>Wage Rate:</strong> ₹${activeEmployeeModel.hourlyRate}/hr</p>
      </div>
    ` : '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Attendance Logs & Audit Report - ${settings.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #334155;
      background: white;
      margin: 40px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.025em;
    }
    .header p {
      font-family: monospace;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin: 4px 0 0 0;
    }
    .header .meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 8px;
    }
    .right-meta {
      text-align: right;
      font-family: monospace;
      font-size: 10px;
      color: #94a3b8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 40px;
      zoom: ${tableZoom}%;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-family: monospace;
      font-weight: bold;
      font-size: 9px;
      text-transform: uppercase;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 10px 12px;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .footer-row {
      font-weight: bold;
      border-top: 2px solid #94a3b8;
      background: #f1f5f9 !important;
    }
    .download-banner {
      display: block;
      background: #e2f0fd;
      border: 1px solid #bce0fd;
      color: #1e3a8a;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      text-align: center;
      margin-bottom: 24px;
      font-weight: 600;
      font-family: sans-serif;
    }
    @media print {
      .download-banner {
        display: none !important;
      }
      body {
        margin: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="download-banner">
      📄 Press Ctrl+P (or Cmd+P on Mac) to print this page or "Save as PDF" directly to your device! (यह फाइल ऑफलाइन प्रिंट के लिए तैयार है, Ctrl+P दबाएं)
    </div>

    <div class="header">
      <div>
        <h1>${settings.companyName} Logs</h1>
        <p>TIMECARD & PAYROLL AUDIT SUMMARY</p>
        <div class="meta">
          Period: <strong>${filterType} report</strong> &bull;
          Export Date: <strong>${new Date().toLocaleDateString()}</strong>
        </div>
      </div>
      <div class="right-meta">
        <p>Report: ATTENDANCE-AUDIT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}</p>
        <p>Generated At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>

    ${activeEmpDetails}

    <table>
      <thead>
        ${tableHeader}
      </thead>
      <tbody>
        ${tableRows}
        <tr class="footer-row">
          <td colspan="11" style="text-align: right; text-transform: uppercase; font-family: monospace; font-size: 10px; color: #475569;">Grand Cumulative Totals:</td>
          <td style="text-align: center; font-weight: bold;">${totalHoursAgg.toFixed(2)}h</td>
          <td style="text-align: center; font-weight: bold; color: #4f46e5;">${totalOTAgg.toFixed(2)}h</td>
          <td></td>
          <td style="text-align: right; font-weight: 900; color: #1e3a8a;">₹${totalPayAgg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Filtered_Attendance_Report_${filterType}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Standalone printable payroll summary generation for offline printing/PDF bypass
  const downloadPayrollSummaryHTML = () => {
    const tableRows = employeePayrollSummaries.length === 0 
      ? `<tr><td colspan="7" style="padding: 32px; text-align: center; color: #94a3b8; font-family: monospace;">No active employee payroll summary items found.</td></tr>`
      : employeePayrollSummaries.map((summary) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; font-family: monospace; font-weight: 600; color: #64748b;">${summary.employeeId}</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #0f172a;">${summary.name}</td>
          <td style="padding: 12px 12px; color: #334155;">${summary.department}</td>
          <td style="padding: 12px 12px; text-align: center; color: #64748b;">₹${summary.hourlyRate}/hr</td>
          <td style="padding: 12px 12px; text-align: center; font-weight: 600;">${summary.totalHours.toFixed(2)}h</td>
          <td style="padding: 12px 12px; text-align: center; font-weight: 600; color: #4f46e5;">${summary.overtimeHours > 0 ? summary.overtimeHours.toFixed(2) + 'h' : '0.00'}</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 800; color: #e11d48; font-family: monospace;">₹${summary.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payroll Summary Report - ${settings.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #334155;
      background: white;
      margin: 40px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.025em;
    }
    .header p {
      font-family: monospace;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin: 4px 0 0 0;
    }
    .header .meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 8px;
    }
    .right-meta {
      text-align: right;
      font-family: monospace;
      font-size: 10px;
      color: #94a3b8;
    }
    .status-badge {
      font-size: 10px;
      font-weight: bold;
      color: #16a34a;
      margin-top: 4px;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .card {
      display: flex;
      flex-direction: column;
    }
    .card .title {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .card .value {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      margin: 4px 0 0 0;
    }
    .card .net-value {
      font-size: 18px;
      font-weight: 900;
      color: #4f46e5;
      margin: 4px 0 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 40px;
      zoom: ${tableZoom}%;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-family: monospace;
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      text-align: left;
      padding: 10px 16px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 10px 16px;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .footer-row {
      font-weight: bold;
      border-top: 2px solid #94a3b8;
      background: #f1f5f9 !important;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      margin-top: 60px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 20px;
    }
    .signature-title {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
      color: #64748b;
    }
    .signature-name {
      font-size: 12px;
      font-weight: bold;
      color: #1e293b;
      margin-top: 4px;
    }
    .signature-sub {
      font-size: 10px;
      color: #94a3b8;
      font-family: monospace;
    }
    .download-banner {
      display: block;
      background: #e0e7ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      text-align: center;
      margin-bottom: 24px;
      font-weight: 600;
      font-family: sans-serif;
    }
    @media print {
      .download-banner {
        display: none !important;
      }
      body {
        margin: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="download-banner">
      📄 Press Ctrl+P (or Cmd+P on Mac) to print this page or "Save as PDF" directly to your device! (यह फाइल ऑफलाइन प्रिंट के लिए तैयार है, Ctrl+P दबाएं)
    </div>

    <div class="header">
      <div>
        <h1>${settings.companyName}</h1>
        <p>Official Payroll & Earnings Audit Sheet</p>
        <div class="meta">
          Period Filter: <strong>${filterType} summary</strong> &bull;
          Filter Mode: <strong>${filterType.toUpperCase()}</strong>
        </div>
      </div>
      <div class="right-meta">
        <p>Document: PAYROLL-REF-${new Date().toISOString().split('T')[0].replace(/-/g, '')}</p>
        <p>Generated At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <div class="status-badge">STATUS: AUDITED & LOCKED</div>
      </div>
    </div>

    <div class="cards-grid">
      <div class="card">
        <span class="title">Cumulative Hours</span>
        <p class="value">${grandSummaryHours.toFixed(2)} hrs</p>
      </div>
      <div class="card">
        <span class="title">Overtime Subtotal</span>
        <p class="value">₹${grandSummaryOvertime.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      </div>
      <div class="card">
        <span class="title" style="color: #4f46e5;">Net Payable Budget</span>
        <p class="net-value">₹${grandSummaryNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Staff ID</th>
          <th>Employee Name</th>
          <th>Department</th>
          <th style="text-align: center;">Hourly Rate</th>
          <th style="text-align: center;">Total Hours</th>
          <th style="text-align: center;">Overtime</th>
          <th style="text-align: right;">Net Payable</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="footer-row">
          <td colspan="4" style="text-align: right; text-transform: uppercase; font-family: monospace; font-size: 10px; color: #475569;">Summary Cumulative Totals:</td>
          <td style="text-align: center; font-weight: bold;">${grandSummaryHours.toFixed(2)}h</td>
          <td style="text-align: center; font-weight: bold; color: #4f46e5;">${employeePayrollSummaries.reduce((sum, item) => sum + item.overtimeHours, 0).toFixed(2)}h</td>
          <td style="text-align: right; font-weight: 900; color: #312e81;">₹${grandSummaryNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    <div class="signatures">
      <div>
        <span class="signature-title">Prepared & Verified By</span>
        <p class="signature-name">HR General / Admin Manager</p>
        <p class="signature-sub">Calitech Finance Operations Desk</p>
      </div>
      <div style="text-align: right;">
        <span class="signature-title">Approved & Signed By</span>
        <p class="signature-name">Director / Authorized Signatory</p>
        <p class="signature-sub">Corporate seal and stamp authorization</p>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Payroll_Summary_Report_${filterType}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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
            onClick={() => setIsWagesLogPreviewOpen(true)}
            id="btn-export-pdf"
            className="flex items-center space-x-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-semibold cursor-pointer shadow-sm shadow-indigo-600/10 transition-colors"
            title="Open preview of wages logs ready for print layout or PDF export"
          >
            <DownloadCloud className="w-4 h-4 text-indigo-200 shrink-0" />
            <span>Print & PDF (Wages Logs)</span>
          </button>
          <button
            onClick={() => setIsPayrollSummaryOpen(true)}
            id="btn-payroll-summary-pdf"
            className="flex items-center space-x-1 px-4 py-2 text-white bg-violet-600 hover:bg-violet-700 rounded-xl text-xs font-semibold cursor-pointer shadow-sm shadow-violet-600/10 transition-colors"
          >
            <Receipt className="w-4 h-4 text-violet-200 shrink-0" />
            <span>Payroll Summary (PDF)</span>
          </button>
          {onClearAttendance && (
            <button
              type="button"
              onClick={() => setIsConfirmClearOpen(true)}
              id="btn-clear-attendance-records"
              className="flex items-center space-x-1 px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-rose-500/15 transition-all"
            >
              <Trash2 className="w-4 h-4 text-rose-150 shrink-0" />
              <span>Clear All Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Prints Layout Header (Only visible on web print view) All styles wrapped in standard tailwind print clauses */}
      <div className="hidden print:block border-b border-slate-300 pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{settings.companyName} Logs</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">TIMECARD & PAYROLL AUDIT SUMMARY</p>
            {activeEmployeeModel && (
              <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-800 space-y-1.5 max-w-2xl">
                <p><strong>Employee Name (पूरा नाम):</strong> {activeEmployeeModel.name} ({activeEmployeeModel.id})</p>
                <p><strong>Residential Address (पता):</strong> {activeEmployeeModel.address || "No address details registered."}</p>
                <p><strong>Department Unit:</strong> {activeEmployeeModel.department} | <strong>Work Email:</strong> {activeEmployeeModel.email} | <strong>Wage Rate:</strong> ₹{activeEmployeeModel.hourlyRate}/hr</p>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            <p>Export Date: {new Date().toLocaleDateString()}</p>
            <p className="uppercase font-semibold">Period: {filterType} report</p>
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

      {/* Selected Employee Detailed Profile - visible on screen and prints */}
      {activeEmployeeModel && (
        <div id="active-employee-print-badge" className="bg-gradient-to-r from-slate-55 to-indigo-50/20 p-5 rounded-2xl border border-indigo-100/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-xs shrink-0">
              <User className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <span className="text-[9px] font-mono font-black tracking-widest text-indigo-650 uppercase">
                Audited Employee Record (कर्मचारी विवरण)
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                {activeEmployeeModel.name}
              </h2>
              <div className="flex flex-wrap items-center mt-1.5 gap-x-3 gap-y-1 text-2xs text-slate-500 font-medium">
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 border border-slate-200 text-slate-600 rounded">
                  ID: {activeEmployeeModel.id}
                </span>
                <span>•</span>
                <span>Dept: <strong className="text-slate-700 font-semibold">{activeEmployeeModel.department}</strong></span>
                <span>•</span>
                <span>Email: <strong className="text-slate-700 font-semibold">{activeEmployeeModel.email}</strong></span>
              </div>
            </div>
          </div>
          
          <div className="md:text-right font-sans md:max-w-md border-t md:border-t-0 border-indigo-50 pt-3 md:pt-0">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
              Residential Address (पूर्ण पता)
            </span>
            <p className="text-xs font-semibold text-slate-700 mt-1 flex md:justify-end items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{activeEmployeeModel.address || "No address details registered."}</span>
            </p>
          </div>
        </div>
      )}

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
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-slate-800">
          <div>
            <h3 className="text-sm font-bold">Timecard & Wage Breakdown</h3>
            <p className="text-3xs text-slate-400 font-mono uppercase mt-0.5">
              Compiled results showing {filteredRecords.length} records matching guidelines
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Table Zoom Controls */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-3xs font-mono shadow-inner">
              <span className="text-slate-400 uppercase font-black select-none mr-1">🔍 Scale:</span>
              <button
                type="button"
                onClick={() => handleZoomChange('out')}
                disabled={tableZoom <= 50}
                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-bold transition-all select-none"
                title="Scale Out (makes more columns fit on small monitors/A4 print views)"
              >
                -
              </button>
              <span className="font-extrabold text-slate-800 text-center w-8 select-none">
                {tableZoom}%
              </span>
              <button
                type="button"
                onClick={() => handleZoomChange('in')}
                disabled={tableZoom >= 120}
                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-bold transition-all select-none"
                title="Scale In"
              >
                +
              </button>
              
              <select
                value={tableZoom}
                onChange={(e) => setTableZoom(Number(e.target.value))}
                className="ml-1 bg-white border border-slate-200 font-sans hover:border-slate-340 rounded px-1.5 py-0.5 text-2xs text-slate-800 font-medium outline-none cursor-pointer"
                title="Select direct table sizing/zoom preset"
              >
                <option value="120">120% (Large Layout)</option>
                <option value="110">110%</option>
                <option value="105">105%</option>
                <option value="100">100% (Default standard)</option>
                <option value="95">95%</option>
                <option value="90">90% (Readable fit)</option>
                <option value="85">85% (Compact)</option>
                <option value="80">80% (Dense columns)</option>
                <option value="75">75% (A4 Perfect Fit)</option>
                <option value="70">70% (Micro table)</option>
                <option value="60">60% (Extra dense)</option>
                <option value="50">50% (Extreme compact)</option>
              </select>
            </div>

            <span className="text-3xs font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
              {presentDaysCount} Presence shifts recorded
            </span>
          </div>
        </div>

        <div className={`overflow-x-auto zoom-${tableZoom}`}>
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
                  
                  const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
                  const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
                  const earnings = calculateEarnings(
                    rec.totalHours || 0,
                    rec.overtime || 0,
                    rate,
                    settings.overtimeRateMultiplier,
                    isIncomplete,
                    emp?.monthlySalary,
                    isHalfDay
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

      {/* CONFIRM CLEAR ATTENDANCE MODAL */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-scaleUp">
            
            {/* Warning Alert Icon Header */}
            <div className="flex items-center space-x-3 pb-3 border-b border-rose-50">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-850 tracking-tight">
                  Clear All Attendance Logs?
                </h3>
                <p className="text-2xs font-bold text-rose-600 uppercase tracking-wider font-mono">
                  Destructive Action
                </p>
              </div>
            </div>

            {/* Bilingual Explanatory Notice */}
            <div className="space-y-3">
              <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                This will permanently delete <span className="text-rose-600 underline font-black">{attendance.length}</span> recorded entry/exit punch logs across all employees. New entries will start fresh.
              </p>
              <div className="bg-rose-50/50 rounded-2xl p-3.5 border border-rose-100/40 text-rose-800 text-[11px] leading-relaxed font-semibold space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <span>ℹ️</span> <span>Hindi Notice:</span>
                </p>
                <p>
                  इससे सभी entry और exit records हमेशा के लिए डिलीट हो जायेंगे। सभी कर्मचारी नए सिरे से अपनी Attendance (Entry/Exit) दर्ज कर सकेंगे।
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setIsConfirmClearOpen(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-205 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel (Cancel करें)
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handlePerformClearAll}
                className="flex-1 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-600/10 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></span>
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>Yes, Clear All (हां, डिलीट करें)</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PAYROLL SUMMARY REPORT MODAL FOR PRINT */}
      {isPayrollSummaryOpen && (
        <div id="payroll-summary-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-slate-100 relative space-y-6 max-h-[90vh] overflow-y-auto animate-scaleIn print:shadow-none print:border-0 print:p-0 print:max-h-none print:overflow-visible">
            
            {/* Header - Screen only */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <span>Payroll Summary PDF Generator</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Print or save clean, structured employee wage lists for accounting audits
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={downloadPayrollSummaryHTML}
                  className="flex items-center space-x-1.5 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-colors"
                  title="Highly recommended: triggers download of offline file ready to print or save to PDF"
                >
                  <DownloadCloud className="w-4 h-4 text-indigo-100" />
                  <span>Download & Print PDF file</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  title="Attempts direct printing through browser workspace iframe setup"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Direct Browser Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPayrollSummaryOpen(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Sheet Container */}
            <div id="payroll-summary-sheet" className="space-y-6 pt-2 print:space-y-8">
              {/* Special print header styles to override everything on printers */}
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #main-application-stage, #main-application-stage * {
                    visibility: hidden;
                  }
                  #payroll-summary-modal-backdrop, #payroll-summary-modal-backdrop * {
                    visibility: visible;
                  }
                  #payroll-summary-sheet, #payroll-summary-sheet * {
                    visibility: visible;
                  }
                  #payroll-summary-modal-backdrop {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background: white !important;
                    display: block !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .print\\:hidden {
                    display: none !important;
                  }
                }
              `}</style>

              {/* Master Company Header */}
              <div className="border-b border-slate-200 pb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{settings.companyName}</h1>
                  <p className="text-3xs font-mono font-bold uppercase tracking-widest text-slate-400 mt-0.5">Official Payroll & Earnings Audit Sheet</p>
                  <div className="flex items-center space-x-3 mt-2 text-2xs text-slate-500 font-medium font-sans">
                    <span>Period Filter: <strong className="text-slate-800 capitalize font-semibold">{filterType} summary</strong></span>
                    <span>•</span>
                    {filterType === 'daily' && <span>Date: <strong className="text-slate-800 font-semibold">{singleDate}</strong></span>}
                    {filterType === 'monthly' && <span>Month: <strong className="text-slate-800 font-semibold">{singleDate.slice(0, 7)}</strong></span>}
                    {filterType === 'custom' && <span>Range: <strong className="text-slate-800 font-semibold">{startDate} to {endDate}</strong></span>}
                  </div>
                </div>
                <div className="text-right text-3xs text-slate-400 font-mono space-y-0.5">
                  <p>Document: PAYROLL-REF-{new Date().toISOString().split('T')[0].replace(/-/g, '')}</p>
                  <p>Generated At: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-[9px] text-green-600 font-bold">STATUS: AUDITED & LOCKED</p>
                </div>
              </div>

              {/* Aggregated Total Cards */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl print:border-slate-300">
                <div className="space-y-0.5 font-sans">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider font-mono">Cumulative Hours</span>
                  <p className="text-base font-black text-slate-900">{grandSummaryHours.toFixed(2)} hrs</p>
                </div>
                <div className="space-y-0.5 font-sans">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider font-mono">Overtime Subtotal</span>
                  <p className="text-base font-black text-slate-900">₹{grandSummaryOvertime.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-0.5 font-sans border-l border-slate-200/80 pl-4 font-sans">
                  <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Net Payable Budget</span>
                  <p className="text-base font-black text-indigo-650">₹{grandSummaryNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Master Summary Table of Employee Wages */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden print:border-slate-300 pointer-events-none">
                <table className="w-full text-left border-collapse text-2xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold tracking-wider uppercase font-mono text-[9px]">
                      <th className="py-2.5 px-4 font-bold">Staff ID</th>
                      <th className="py-2.5 px-4 font-bold">Employee Name</th>
                      <th className="py-2.5 px-3 font-bold">Department</th>
                      <th className="py-2.5 px-3 text-center font-bold">Hourly Rate</th>
                      <th className="py-2.5 px-3 text-center font-bold">Total Hours</th>
                      <th className="py-2.5 px-3 text-center font-bold">Overtime (Hrs)</th>
                      <th className="py-2.5 px-4 text-right font-bold">Net Payable Amnt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-800">
                    {employeePayrollSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                          No active employee payroll summary items found for specified parameters.
                        </td>
                      </tr>
                    ) : (
                      employeePayrollSummaries.map((summary) => (
                        <tr key={summary.employeeId} className="hover:bg-slate-50/10">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-500">
                            {summary.employeeId}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {summary.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {summary.department}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-500 font-sans">
                            ₹{summary.hourlyRate}/hr
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold">
                            {summary.totalHours.toFixed(2)}h
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-indigo-600 font-semibold">
                            {summary.overtimeHours > 0 ? `${summary.overtimeHours.toFixed(2)}h` : '0.00'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-rose-650">
                            ₹{summary.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-55 border-t border-slate-300 font-bold font-sans">
                      <td colSpan={4} className="py-3 px-4 font-mono uppercase tracking-widest text-[9px] text-slate-500 text-right">
                        Summary Cumulative Totals:
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-extrabold text-slate-900">
                        {grandSummaryHours.toFixed(2)}h
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-700 font-extrabold">
                        {employeePayrollSummaries.reduce((sum, item) => sum + item.overtimeHours, 0).toFixed(2)}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-indigo-900 bg-slate-100/50">
                        ₹{grandSummaryNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Certification stamp & signatory fields for compliance printouts */}
              <div className="grid grid-cols-2 gap-12 pt-10 print:pt-16 font-sans">
                <div className="border-t border-dashed border-slate-300 pt-3">
                  <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold block font-mono">Prepared & Verified By</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">HR General / Admin Manager</p>
                  <p className="text-3xs text-slate-400 mt-0.5 font-mono">Calitech Finance Operations Desk</p>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-3 text-right">
                  <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold block font-mono">Approved & Signed By</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">Director / Authorized Signatory</p>
                  <p className="text-3xs text-slate-400 mt-0.5 font-mono">Corporate seal and stamp authorization</p>
                </div>
              </div>
            </div>

            {/* Fine print footnote - Screen only */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] leading-relaxed text-slate-400 text-center print:hidden font-sans">
              Press <strong>"Print PDF"</strong> above to trigger standard operating system page layouts. For landscape standard documents, please specify Landscape orientation in your browser's printing panel before saving as PDF.
            </div>
          </div>
        </div>
      )}

      {/* WAGES LOG PREVIEW MODAL FOR PRINT */}
      {isWagesLogPreviewOpen && (
        <div id="wages-log-preview-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-5xl w-full shadow-2xl border border-slate-100 relative space-y-6 max-h-[90vh] overflow-y-auto animate-scaleIn print:shadow-none print:border-0 print:p-0 print:max-h-none print:overflow-visible">
            
            {/* Header - Screen only */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <span>Timecard & Wages Logs Preview (प्रिंट प्रीव्यू)</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Verify the compiled shift entries & wages before triggering download or printing.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={downloadFilteredLogsHTML}
                  className="flex items-center space-x-1.5 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-colors"
                  title="Download and save the offline report HTML format which automatically triggers printing when opened"
                >
                  <DownloadCloud className="w-4 h-4 text-indigo-100 shrink-0" />
                  <span>Download HTML Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  title="Attempts direct printing through browser workspace setup"
                >
                  <Printer className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Direct Browser Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWagesLogPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Sheet Container */}
            <div id="wages-log-preview-sheet" className="space-y-6 pt-2 print:space-y-8">
              {/* Special print header styles to override everything on printers */}
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #main-application-stage, #main-application-stage * {
                    visibility: hidden;
                  }
                  #payroll-summary-modal-backdrop, #payroll-summary-modal-backdrop * {
                    visibility: hidden;
                  }
                  #wages-log-preview-modal-backdrop, #wages-log-preview-modal-backdrop * {
                    visibility: visible;
                  }
                  #wages-log-preview-sheet, #wages-log-preview-sheet * {
                    visibility: visible;
                  }
                }
              `}</style>

              {/* Special print header view */}
              <div className="hidden print:flex justify-between items-start border-b border-slate-300 pb-6">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{settings.companyName} Logs</h1>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">TIMECARD & PAYROLL AUDIT SUMMARY</p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Report period: <strong className="text-slate-700">{filterType} summary</strong> &bull; Generated: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right font-mono text-[9px] text-slate-400 space-y-0.5">
                  <p>Document: ATTENDANCE-WAGES-LOG</p>
                  <p>Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
              </div>

              {/* Selected Employee Detailed Profile */}
              {activeEmployeeModel && (
                <div className="bg-indigo-50/55 p-4 rounded-2xl border border-indigo-100 flex flex-col md:flex-row justify-between gap-4 print:border-slate-300 print:bg-white text-left">
                  <div className="space-y-1">
                    <span className="text-[9px] text-indigo-600 uppercase tracking-wider font-extrabold font-mono block">Audited Staff Member</span>
                    <h2 className="text-sm font-black text-slate-800">{activeEmployeeModel.name} (ID: {activeEmployeeModel.id})</h2>
                    <p className="text-2xs text-slate-500 font-sans">
                      Department: <strong>{activeEmployeeModel.department || 'General'}</strong> &bull; Email: <strong>{activeEmployeeModel.email}</strong>
                    </p>
                    <p className="text-2xs text-slate-500 font-sans">
                      Residence Address (पता): <strong>{activeEmployeeModel.address || "No address registered."}</strong>
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-indigo-100/60 flex items-center space-x-3 self-start print:border-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Wage Rate</span>
                      <strong className="text-xs font-black text-indigo-600">₹{activeEmployeeModel.hourlyRate}/hr</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Aggregates Dashboard Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl print:border-slate-300 print:bg-white text-left">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block font-mono">Matched Records</span>
                  <span className="text-lg font-black text-slate-800 mt-0.5">{filteredRecords.length} logs</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block font-mono">Aggregate Hours</span>
                  <span className="text-lg font-black text-indigo-650 mt-0.5">
                    {filteredRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0).toFixed(2)}h
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block font-mono">Overtime Hours</span>
                  <span className="text-lg font-black text-amber-650 mt-0.5">
                    {filteredRecords.reduce((sum, r) => sum + (r.overtime || 0), 0).toFixed(2)}h
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-indigo-600 uppercase tracking-wider font-bold block font-mono">Grand Total Est.</span>
                  <span className="text-lg font-black text-rose-650 mt-0.5 font-sans">
                    ₹{filteredRecords.reduce((sum, r) => {
                      const emp = employees.find((e) => e.id === r.employeeId);
                      const rate = emp ? emp.hourlyRate : 25;
                      const isHalfDay = r.status ? r.status.includes('Half Day') : false;
                      const isIncomplete = !!((r.entryTime && !r.exitTime) || (r.entryTime2 && !r.exitTime2));
                      return sum + calculateEarnings(
                        r.totalHours, 
                        r.overtime, 
                        rate, 
                        settings.overtimeRateMultiplier, 
                        isIncomplete,
                        emp?.monthlySalary,
                        isHalfDay
                      ).totalPay;
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Table listing */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden print:border-slate-300">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-[9px] uppercase font-mono tracking-wider border-b border-slate-200">
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-3">Emp ID & Name</th>
                      <th className="py-2 px-2 text-center">Entry Time</th>
                      <th className="py-2 px-2 text-center">Lunch Out</th>
                      <th className="py-2 px-2 text-center">Lunch In</th>
                      <th className="py-2 px-2 text-center">Exit Time</th>
                      <th className="py-2 px-2 text-center">Entry Time 2</th>
                      <th className="py-2 px-2 text-center">Dinner Out</th>
                      <th className="py-2 px-2 text-center">Dinner In</th>
                      <th className="py-2 px-2 text-center">Exit Time 2</th>
                      <th className="py-2 px-3 text-center">Work Hours</th>
                      <th className="py-2 px-3 text-center">Overtime</th>
                      <th className="py-2 px-3 text-center">Wage Rate</th>
                      <th className="py-2 px-4 text-right">Computed Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-8 text-center text-slate-400 text-xs font-mono">
                           No active logs inside the preview. Use the report filters to adjust selections.
                        </td>
                      </tr>
                    ) : (
                       filteredRecords.map((rec) => {
                        const emp = employees.find((e) => e.id === rec.employeeId);
                        const rate = emp ? emp.hourlyRate : 25;
                        const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
                        const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
                        const earnings = calculateEarnings(
                          rec.totalHours || 0,
                          rec.overtime || 0,
                          rate,
                          settings.overtimeRateMultiplier,
                          isIncomplete,
                          emp?.monthlySalary,
                          isHalfDay
                        );
                        return (
                          <tr key={`preview-${rec.employeeId}-${rec.date}`} className="hover:bg-slate-50/55 print:hover:bg-white text-3xs sm:text-2xs">
                            <td className="py-2 px-4 font-mono font-semibold text-slate-600">
                              {rec.date}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-slate-800">{rec.employeeName}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{rec.employeeId}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-700">
                              {rec.entryTime || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-450">
                              {rec.lunchOut || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-450">
                              {rec.lunchIn || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-700">
                              {rec.exitTime || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-indigo-600">
                              {rec.entryTime2 || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-rose-500">
                              {rec.dinnerOut || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-rose-500">
                              {rec.dinnerIn || '--:--'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-indigo-600">
                              {rec.exitTime2 || '--:--'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-semibold text-slate-800">
                              {rec.totalHours.toFixed(2)}h
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">
                              {rec.overtime > 0 ? `+${rec.overtime.toFixed(2)}h` : '--'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              ₹{rate}/hr
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-950">
                              ₹{earnings.totalPay.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Certification stamp & signatory fields for compliance printouts */}
              <div className="grid grid-cols-2 gap-12 pt-10 print:pt-16 font-sans">
                <div className="text-left border-t border-dashed border-slate-300 pt-3">
                  <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold block font-mono">Prepared & Verified By</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">HR General / Admin Manager</p>
                  <p className="text-3xs text-slate-400 mt-0.5 font-mono">{settings.companyName} Finance Operations Desk</p>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-3 text-right">
                  <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold block font-mono">Approved & Signed By</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">Director / Authorized Signatory</p>
                  <p className="text-3xs text-slate-400 mt-0.5 font-mono">Corporate seal and stamp authorization</p>
                </div>
              </div>

            </div>

            {/* Fine print footnote - Screen only */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] leading-relaxed text-slate-400 text-center print:hidden font-sans">
              Press <strong>"Direct Browser Print"</strong> above to launch your operating system printing options. You can choose to print to paper or <strong>"Save as PDF"</strong>. For wider layout alignments, select landscape page orientation in your printing setups.
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
