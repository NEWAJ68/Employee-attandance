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
  TrendingUp,
  Megaphone,
  Bell,
  ShieldAlert,
  Printer,
  FileText
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Settings, AppNotification } from '../types';
import { calculateEarnings, getLocalDateString } from '../utils/calculations';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface MyAttendanceViewProps {
  loggedInEmployee: Employee;
  attendance: AttendanceRecord[];
  onNavigateToView?: (view: string) => void;
  onUpdateEmployee?: (employee: Employee) => void;
  settings?: Settings;
  notifications: AppNotification[];
  onMarkNotificationRead?: (id: string) => void;
}

export default function MyAttendanceView({
  loggedInEmployee,
  attendance,
  onNavigateToView,
  onUpdateEmployee,
  settings,
  notifications = [],
  onMarkNotificationRead
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
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
  const sumWorkHours = processedLogs.reduce((acc, current) => {
    const rec = current.rawRecord;
    if (!rec) return acc;
    const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
    if (isIncomplete || current.hours < 3) return acc;
    return acc + current.hours;
  }, 0);

  // Compute earnings and details for Monthly Payroll Summary Card
  const currencySymbol = '₹';

  const totalOvertimeHours = processedLogs.reduce((acc, curr) => {
    const rec = curr.rawRecord;
    if (!rec) return acc;
    const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
    if (isIncomplete || curr.hours < 3) return acc;
    return acc + curr.overtime;
  }, 0);
  const totalStandardHours = Math.max(0, sumWorkHours - totalOvertimeHours);

  let regularPay = 0;
  let overtimePay = 0;
  let totalPay = 0;

  if (loggedInEmployee.monthlySalary && loggedInEmployee.monthlySalary > 0) {
    processedLogs.forEach(curr => {
      const rec = curr.rawRecord;
      if (!rec) return;
      const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
      const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
      const dayEarnings = calculateEarnings(
        curr.hours,
        curr.overtime,
        loggedInEmployee.hourlyRate,
        settings?.overtimeRateMultiplier || 1.5,
        isIncomplete,
        loggedInEmployee.monthlySalary,
        isHalfDay
      );
      regularPay += dayEarnings.regularPay;
      overtimePay += dayEarnings.overtimePay;
      totalPay += dayEarnings.totalPay;
    });
    regularPay = Math.round(regularPay * 100) / 100;
    overtimePay = Math.round(overtimePay * 100) / 100;
    totalPay = Math.round(totalPay * 100) / 100;
  } else {
    const earnings = calculateEarnings(
      sumWorkHours,
      totalOvertimeHours,
      loggedInEmployee.hourlyRate,
      settings?.overtimeRateMultiplier || 1.5
    );
    regularPay = earnings.regularPay;
    overtimePay = earnings.overtimePay;
    totalPay = earnings.totalPay;
  }

  // Filter out system technical status logs and admin action logs to clean up standard employee notice board
  const EXCLUDED_SYSTEM_TITLES = [
    "Offline Punch Synced",
    "Database Sync Restored",
    "Database Sync Failed",
    "Sync Warning",
    "Workforce Reset",
    "Offline Punch Queued",
    "Late Entry Alert",
    "Duplicate Entry Attempt",
    "Early Exit Alert",
    "New Leave Request",
    "Database Cleared",
    "Google Account Connected",
    "Google Authentication Failed",
    "Google Account Disconnected",
    "New Spreadsheet Created",
    "BLOCKED Out-of-Range Punch",
    "Out-of-Range Punch Alert",
    "Push Authorized"
  ];

  const employeeNotifications = notifications.filter(n => {
    // Must be targeted at the employee or a general broadcast
    const isTargeted = !n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast" || n.employeeId === loggedInEmployee.id;
    if (!isTargeted) return false;

    // Filter out unnecessary/technical system status logs or admin alerts
    return !EXCLUDED_SYSTEM_TITLES.includes(n.title);
  });

  const unreadEmployeeNotifications = employeeNotifications.filter(n => {
    const isPersonal = n.employeeId && n.employeeId !== "" && n.employeeId !== "all" && n.employeeId !== "broadcast";
    return isPersonal ? !n.read : !(n.readByEmployees || []).includes(loggedInEmployee.id);
  });

  const getFriendlyMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleGenerateDirectPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      // Small delay to let rendering refresh if needed
      await new Promise((resolve) => setTimeout(resolve, 310));
      const element = document.getElementById("attendance-statement-direct-pdf-sheet");
      if (!element) {
        throw new Error("Target PDF sheet not detected inside DOM");
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`Attendance_Statement_${loggedInEmployee.id}_${selectedMonth}.pdf`);
    } catch (err) {
      console.error("Direct PDF rendering aborted:", err);
      alert("Something went wrong compiling PDF. Downloading offline HTML sheet instead.");
      handleDownloadPDF();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPDF = () => {
    const companyName = settings?.companyName || 'Calitech Engineering Solutions';
    const friendlyMonth = getFriendlyMonthName(selectedMonth);
    const printedOn = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const tableRows = processedLogs.map(curr => {
      const rec = curr.rawRecord;
      const hoursStr = curr.hours > 0 ? `${curr.hours.toFixed(2)}h` : '--';
      const otStr = curr.overtime > 0 ? `${curr.overtime.toFixed(2)}h` : '--';
      const statusColor = curr.status === 'Present' ? '#10b981' : 
                          curr.status === 'Late Entry' ? '#f59e0b' :
                          curr.status === 'On Leave' ? '#4f46e5' :
                          curr.status === 'Weekly Off' ? '#64748b' : '#ef4444';

      let dayEarnings = { regularPay: 0, overtimePay: 0, totalPay: 0 };
      if (rec) {
        const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
        const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
        dayEarnings = calculateEarnings(
          curr.hours,
          curr.overtime,
          loggedInEmployee.hourlyRate,
          settings?.overtimeRateMultiplier || 1.5,
          isIncomplete,
          loggedInEmployee.monthlySalary,
          isHalfDay
        );
      }

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.dateString}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.dayLabel}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; font-weight: bold; color: ${statusColor}; text-align: center;">${curr.status}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.clockIn}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.clockOut}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${hoursStr}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #4f46e5;">${otStr}</td>
          <td style="font-family: monospace; font-weight: bold; border: 1px solid #e2e8f0; padding: 8px; text-align: right; color: #1e3a8a;">₹${dayEarnings.totalPay.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Statement - ${loggedInEmployee.name} - ${friendlyMonth}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #f8fafc;
    }
    .container {
      max-width: 900px;
      margin: 30px auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      border: 1px solid #e2e8f0;
    }
    .print-banner {
      background: #e0e7ff;
      border: 1px solid #6366f1;
      color: #3730a3;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 13px;
      text-align: center;
      font-weight: bold;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px double #cbd5e1;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-grid {
      display: grid;
      grid-template-cols: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 25px;
      background: #f1f5f9;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .meta-item {
      font-size: 12px;
    }
    .meta-label {
      font-weight: bold;
      color: #64748b;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .meta-val {
      font-weight: 700;
      color: #0f172a;
      font-size: 13px;
    }
    .stats-grid {
      display: grid;
      grid-template-cols: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      background: #fafafa;
    }
    .stat-lbl {
      font-size: 10px;
      font-weight: bold;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 16px;
      font-weight: 800;
      color: #0d1e3d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 30px;
    }
    th {
      background: #0f172a;
      color: white;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      border: 1px solid #1e293b;
      padding: 10px 8px;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .signatures-section {
      display: grid;
      grid-template-cols: repeat(2, 1fr);
      gap: 40px;
      margin-top: 50px;
      padding-top: 30px;
      border-top: 1px solid #e2e8f0;
    }
    .sign-box {
      border-top: 1px dashed #cbd5e1;
      text-align: center;
      padding-top: 8px;
      font-size: 12px;
      font-weight: bold;
      color: #475569;
    }
    @media print {
      body {
        background: white;
      }
      .container {
        border-radius: 0;
        box-shadow: none;
        border: none;
        padding: 0;
        margin: 0;
        max-width: 100%;
      }
      .print-banner {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="print-banner">
      📄 Press Ctrl+P (or Cmd+P on Mac) to print this page or save as a digital PDF!
    </div>

    <div class="header">
      <div>
        <h1>${companyName}</h1>
        <p>Employee Attendance & Wage Statement</p>
      </div>
      <div style="text-align: right; font-size: 12px; color: #475569;">
        <div>Statement Period: <strong>${friendlyMonth}</strong></div>
        <div style="font-size: 10px; margin-top: 4px;">Generated On: ${printedOn}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Employee Name</div>
        <div class="meta-val">${loggedInEmployee.name}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Employee ID</div>
        <div class="meta-val">${loggedInEmployee.id}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Department Unit</div>
        <div class="meta-val">${loggedInEmployee.department}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Joined Date</div>
        <div class="meta-val">${loggedInEmployee.joinedDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Monthly Fixed Salary</div>
        <div class="meta-val">${loggedInEmployee.monthlySalary ? `₹${loggedInEmployee.monthlySalary.toFixed(2)}/mo` : 'N/A'}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Hourly Overtime Rate</div>
        <div class="meta-val">₹${loggedInEmployee.hourlyRate.toFixed(2)}/hr</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-lbl">Days Present</div>
        <div class="stat-val" style="color: #10b981;">${presentDaysCount} days</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Days Absent</div>
        <div class="stat-val" style="color: #ef4444;">${absentDaysCount} days</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Active Leave</div>
        <div class="stat-val" style="color: #4f46e5;">${leavesCount} days</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Total Work Hours</div>
        <div class="stat-val" style="color: #0f172a;">${sumWorkHours.toFixed(1)} hrs</div>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-cols: repeat(3, 1fr);">
      <div class="stat-card">
        <div class="stat-lbl">Standard Hours Pay</div>
        <div class="stat-val">₹${regularPay.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Overtime Compensation</div>
        <div class="stat-val" style="color: #4f46e5;">₹${overtimePay.toFixed(2)}</div>
      </div>
      <div class="stat-card" style="background: #e0f2fe; border-color: #bae6fd;">
        <div class="stat-lbl">Calculated Payout</div>
        <div class="stat-val" style="color: #0369a1; font-size: 18px; font-weight: 900;">₹${totalPay.toFixed(2)}</div>
      </div>
    </div>

    <h3 style="font-size: 13px; text-transform: uppercase; color: #334155; margin-bottom: 12px; margin-top: 30px; letter-spacing: 0.05em;">Shift Logs & Punch Records</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th>Status</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>Worked Hours</th>
          <th>Overtime Hours</th>
          <th>Wage (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="signatures-section">
      <div class="sign-box">
        Employee Signature
      </div>
      <div class="sign-box">
        Authorized Representative Sign / Stamp
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
    link.download = `Attendance_Statement_${loggedInEmployee.id}_${selectedMonth}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

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

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-2xs transition-all cursor-pointer w-full sm:w-auto"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download CSV</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateDirectPDF}
                disabled={isGeneratingPdf}
                className={`flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-2xs transition-all shadow-sm cursor-pointer w-full sm:w-auto ${
                  isGeneratingPdf ? 'opacity-75 cursor-not-allowed' : 'animate-pulse'
                }`}
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                    <span>Direct downloading PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5" />
                    <span>Download PDF Statement</span>
                  </>
                )}
              </button>
            </div>
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

      {/* 📢 PERSISTENT EMPLOYEE NOTICE BOARD & MEMOS */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
          <div className="flex items-center space-x-2">
            <Megaphone className="w-5 h-5 text-indigo-600 animate-bounce" />
            <div>
              <h2 className="text-sm font-black text-slate-950 tracking-tight">My Notice Board & Alerts</h2>
              <p className="text-[10px] text-slate-400 font-medium">Personal assignments, shift warnings, and administrative memos.</p>
            </div>
          </div>
          {unreadEmployeeNotifications.length > 0 && (
            <span className="bg-rose-150 text-rose-800 border border-rose-200/50 text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
              {unreadEmployeeNotifications.length} New Message(s)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
          {employeeNotifications.length === 0 ? (
            <div className="col-span-1 md:col-span-2 py-10 text-center flex flex-col items-center justify-center space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
              <span className="p-2 sm:p-3 bg-slate-100 text-slate-450 rounded-full">
                <Bell className="w-5 h-5 opacity-40" />
              </span>
              <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest block">Noticeboard is Clear</p>
              <p className="text-3xs text-slate-400 max-w-[240px]">No administrative broadcasts or warning notifications have been logged to your ID today.</p>
            </div>
          ) : (
            employeeNotifications
              // Sort newest first
              .sort((a, b) => b.id.localeCompare(a.id))
              .map((notif) => {
                let priorityBorder = 'border-slate-100 bg-slate-50/40';
                let priorityTitle = 'text-slate-800';
                let priorityIcon = <Bell className="w-4 h-4 text-slate-500" />;

                if (notif.type === 'warning') {
                  priorityBorder = 'border-amber-200 bg-amber-50/20';
                  priorityTitle = 'text-amber-955';
                  priorityIcon = <AlertCircle className="w-4 h-4 text-amber-500" />;
                } else if (notif.type === 'alert') {
                  priorityBorder = 'border-rose-200 bg-rose-50/20';
                  priorityTitle = 'text-rose-955';
                  priorityIcon = <ShieldAlert className="w-4 h-4 text-rose-500" />;
                } else if (notif.type === 'success') {
                  priorityBorder = 'border-emerald-200 bg-emerald-50/10';
                  priorityTitle = 'text-emerald-950';
                  priorityIcon = <CheckCircle className="w-4 h-4 text-emerald-500" />;
                } else {
                  priorityBorder = 'border-indigo-150 bg-[#EEF2F6]/40';
                  priorityTitle = 'text-indigo-950';
                  priorityIcon = <Megaphone className="w-4 h-4 text-indigo-650" />;
                }

                const hasBeenRead = (notif.employeeId && notif.employeeId !== "" && notif.employeeId !== "all" && notif.employeeId !== "broadcast")
                  ? notif.read
                  : (notif.readByEmployees || []).includes(loggedInEmployee.id);

                return (
                  <div 
                    key={notif.id}
                    className={`p-4 rounded-2xl border transition-all flex gap-3 items-start ${
                      hasBeenRead ? 'opacity-60 bg-slate-50/40 border-slate-100' : `${priorityBorder}`
                    }`}
                  >
                    <div className="shrink-0 p-1.5 bg-white/70 rounded-xl shadow-3xs">{priorityIcon}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-black ${priorityTitle} flex items-center gap-1.5`}>
                          <span>{notif.title}</span>
                          {(!notif.employeeId || notif.employeeId === "" || notif.employeeId === "all" || notif.employeeId === "broadcast") && (
                            <span className="bg-indigo-100 text-indigo-700 text-[8px] font-bold px-1 rounded font-sans uppercase">
                              ALL STAFF
                            </span>
                          )}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-400">{notif.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">{notif.message}</p>
                      
                      {!hasBeenRead && onMarkNotificationRead && (
                        <button
                          type="button"
                          onClick={() => onMarkNotificationRead(notif.id)}
                          className="inline-flex items-center gap-1 text-[9px] text-indigo-700 hover:text-indigo-950 font-extrabold uppercase mt-2 hover:underline cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-indigo-650" />
                          <span>Acknowledge Message</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
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
              const isToday = getLocalDateString(new Date()) === dateStringVal;

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
                      INR
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
      {/* 📄 INVISIBLE PDF COMPILATION CONTAINER FOR PIXEL-PERFECT EXPORTS */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '850px', pointerEvents: 'none', zIndex: -1000 }}>
        <div id="attendance-statement-direct-pdf-sheet" className="bg-white p-8 space-y-6 text-slate-800" style={{ width: '850px' }}>
          
          {/* Header section */}
          <div className="flex justify-between items-start border-b-2 border-slate-200 pb-5">
            <div className="text-left">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">
                {settings?.companyName || 'Calitech Engineering Solutions'}
              </h1>
              <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase mt-1">
                Employee Attendance & Wage Statement
              </p>
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-500 font-bold uppercase tracking-wide">Statement Period</div>
              <div className="font-extrabold text-indigo-700 text-sm mt-0.5">{getFriendlyMonthName(selectedMonth)}</div>
              <div className="text-[9px] text-slate-400 mt-1">
                Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* ID Details Card */}
          <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl text-left">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Employee Name</div>
              <div className="text-xs font-bold text-slate-800">{loggedInEmployee.name}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Employee ID</div>
              <div className="text-xs font-mono font-bold text-slate-800">{loggedInEmployee.id}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Department</div>
              <div className="text-xs font-bold text-slate-800">{loggedInEmployee.department}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Joined Date</div>
              <div className="text-xs font-semibold text-slate-700">{loggedInEmployee.joinedDate}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Monthly Salary</div>
              <div className="text-xs font-bold text-slate-800">
                {loggedInEmployee.monthlySalary ? `₹${loggedInEmployee.monthlySalary.toFixed(2)}/mo` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-450">Overtime Wage</div>
              <div className="text-xs font-mono font-bold text-indigo-650">
                ₹{loggedInEmployee.hourlyRate.toFixed(2)}/hr
              </div>
            </div>
          </div>

          {/* Summary Indicators */}
          <div className="grid grid-cols-4 gap-3">
            <div className="border border-slate-200 p-3 rounded-xl text-center bg-slate-50/20">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-400">Present</div>
              <div className="text-xs sm:text-sm font-black text-emerald-600 mt-1">{presentDaysCount} Days</div>
            </div>
            <div className="border border-slate-200 p-3 rounded-xl text-center bg-slate-50/20">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-400">Absent</div>
              <div className="text-xs sm:text-sm font-black text-rose-650 mt-1">{absentDaysCount} Days</div>
            </div>
            <div className="border border-slate-200 p-3 rounded-xl text-center bg-slate-50/20">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-400">Leaves</div>
              <div className="text-xs sm:text-sm font-black text-indigo-655 mt-1">{leavesCount} Days</div>
            </div>
            <div className="border border-slate-200 p-3 rounded-xl text-center bg-slate-50/20">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-400">Work Hours</div>
              <div className="text-xs sm:text-sm font-black text-slate-800 mt-1">{sumWorkHours.toFixed(1)} Hrs</div>
            </div>
          </div>

          {/* Earnings Details */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-150 p-3 rounded-xl text-left bg-slate-50/50">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-450">Standard Earnings</div>
              <div className="text-xs font-mono font-bold text-slate-800 mt-1">₹{regularPay.toFixed(2)}</div>
            </div>
            <div className="border border-slate-150 p-3 rounded-xl text-left bg-slate-50/50">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-450">Overtime Earnings</div>
              <div className="text-xs font-mono font-bold text-indigo-650 mt-1">₹{overtimePay.toFixed(2)}</div>
            </div>
            <div className="border border-sky-100 p-3 rounded-xl text-left bg-sky-50/30">
              <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-sky-600 font-extrabold">Net Pay Estimate</div>
              <div className="text-sm font-extrabold text-blue-800 mt-0.5">₹{totalPay.toFixed(2)}</div>
            </div>
          </div>

          {/* Detailed logs table */}
          <div className="border border-slate-205 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-3xs sm:text-2xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase font-mono tracking-wider">
                  <th className="py-2 px-3 text-center">Date</th>
                  <th className="py-2 px-3">Day</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-center">Entry</th>
                  <th className="py-2 px-3 text-center">Exit</th>
                  <th className="py-3 px-3 text-center flex-1">Hours</th>
                  <th className="py-2 px-3 text-center">Overtime</th>
                  <th className="py-2 px-3 text-right">Wage (₹)</th>
                </tr>
              </thead>
              <tbody>
                {processedLogs.map((curr) => {
                  const rec = curr.rawRecord;
                  const statusColor = curr.status === 'Present' ? 'text-emerald-600' : 
                                      curr.status === 'Late Entry' ? 'text-amber-500' :
                                      curr.status === 'On Leave' ? 'text-indigo-600' :
                                      curr.status === 'Weekly Off' ? 'text-slate-400' : 'text-rose-500';

                  let dayEarnings = { totalPay: 0 };
                  if (rec) {
                    const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
                    const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
                    dayEarnings = calculateEarnings(
                      curr.hours,
                      curr.overtime,
                      loggedInEmployee.hourlyRate,
                      settings?.overtimeRateMultiplier || 1.5,
                      isIncomplete,
                      loggedInEmployee.monthlySalary,
                      isHalfDay
                    );
                  }

                  return (
                    <tr key={curr.dateString} className="border-b border-slate-150 bg-white font-sans text-left">
                      <td className="py-1.5 px-3 text-center font-mono font-semibold">{curr.dateString}</td>
                      <td className="py-1.5 px-3 text-slate-500">{curr.dayLabel}</td>
                      <td className={`py-1.5 px-3 font-semibold ${statusColor}`}>{curr.status}</td>
                      <td className="py-1.5 px-3 text-center font-mono text-slate-650">{curr.clockIn}</td>
                      <td className="py-1.5 px-3 text-center font-mono text-slate-650">{curr.clockOut}</td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-700">
                        {curr.hours > 0 ? `${curr.hours.toFixed(2)}h` : '--'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-indigo-600">
                        {curr.overtime > 0 ? `${curr.overtime.toFixed(1)}h` : '--'}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{dayEarnings.totalPay.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signatures section for PDF compliance */}
          <div className="grid grid-cols-2 gap-12 pt-8 pb-3 font-sans">
            <div className="border-t border-dashed border-slate-300 pt-2 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Employee Signature</p>
              <p className="text-[8px] text-slate-400 mt-1">Verification of logged punch shifts</p>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-2 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Authorized Representative Sign / Stamp</p>
              <p className="text-[8px] text-slate-400 mt-1">{settings?.companyName || 'Calitech Engineering Solutions Ltd.'}</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
