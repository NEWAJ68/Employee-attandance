import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
  Send,
  FileSpreadsheet
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings, AppNotification, LeaveRequest } from '../types';
import { getShiftConfig, minutesDiffFromStart, calculateEarnings, getProcessedLogsForEmployee, formatDateDMY, getLocalDateString } from '../utils/calculations';

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
  const [isAdminGeneratingPdf, setIsAdminGeneratingPdf] = useState(false);

  // States for Admin Monthly PDF Statement Downloader
  const [selectedStatementEmpId, setSelectedStatementEmpId] = useState('');
  const [selectedStatementMonth, setSelectedStatementMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7); // Default to current month "YYYY-MM"
  });

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

  const getFriendlyMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleDownloadAdminStatement = async () => {
    if (!selectedStatementEmpId) {
      alert("Please select an employee first to download their statement.");
      return;
    }
    const selectedEmp = employees.find(emp => emp.id === selectedStatementEmpId);
    if (!selectedEmp) {
      alert("Selected employee not found.");
      return;
    }

    setIsAdminGeneratingPdf(true);
    try {
      // Small delay to let rendering refresh if needed
      await new Promise((resolve) => setTimeout(resolve, 310));
      const page1 = document.getElementById("admin-attendance-statement-direct-pdf-page-1");
      const page2 = document.getElementById("admin-attendance-statement-direct-pdf-page-2");
      if (!page1 || !page2) {
        throw new Error("Target PDF pages not detected inside DOM");
      }

      const canvas1 = await html2canvas(page1, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const canvas2 = await html2canvas(page2, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = 297; // exact A4 height in mm

      const imgData1 = canvas1.toDataURL("image/png");
      pdf.addImage(imgData1, "PNG", 0, 0, imgWidth, imgHeight, undefined, 'FAST');

      pdf.addPage();
      const imgData2 = canvas2.toDataURL("image/png");
      pdf.addImage(imgData2, "PNG", 0, 0, imgWidth, imgHeight, undefined, 'FAST');

      pdf.save(`Attendance_Statement_${selectedEmp.id}_${selectedStatementMonth}.pdf`);
    } catch (err) {
      console.error("Direct PDF rendering aborted:", err);
      alert("Something went wrong compiling PDF. Please try again.");
    } finally {
      setIsAdminGeneratingPdf(false);
    }
  };

  const handleDownloadAdminStatement_deprecated_do_not_use = () => {
    if (!selectedStatementEmpId) {
      alert("Please select an employee first to download their statement.");
      return;
    }
    const selectedEmp = employees.find(emp => emp.id === selectedStatementEmpId);
    if (!selectedEmp) {
      alert("Selected employee not found.");
      return;
    }

    const companyName = settings?.companyName || 'Apex Tech Solutions';
    const friendlyMonth = getFriendlyMonthName(selectedStatementMonth);
    const printedOn = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Filter attendance logs for selected employee and month
    const empLogs = attendance.filter(rec => rec.employeeId === selectedStatementEmpId && rec.date.startsWith(selectedStatementMonth));
    const safeSettings = settings;

    // Use calculations utility helper
    const processedLogs = getProcessedLogsForEmployee(empLogs, selectedEmp, selectedStatementMonth, safeSettings);

    const presentDaysCount = processedLogs.filter(l => ['Present', 'Late Entry', 'Night Shift'].includes(l.status)).length;
    const halfDaysCount = processedLogs.filter(l => l.status === 'Half Day').length;
    const absentDaysCount = processedLogs.filter(l => l.status === 'Absent').length;
    const leavesCount = processedLogs.filter(l => l.status === 'On Leave').length;

    const sumWorkHours = processedLogs.reduce((acc, current) => {
      const rec = current.rawRecord;
      if (!rec) return acc;
      const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
      if (isIncomplete || current.hours < 3) return acc;
      return acc + current.hours;
    }, 0);

    const totalOvertimeHours = processedLogs.reduce((acc, curr) => {
      const rec = curr.rawRecord;
      if (!rec) return acc;
      const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
      if (isIncomplete || curr.hours < 3) return acc;
      return acc + curr.overtime;
    }, 0);

    let regularPay = 0;
    let overtimePay = 0;
    let totalPay = 0;

    if (selectedEmp.monthlySalary && selectedEmp.monthlySalary > 0) {
      processedLogs.forEach(curr => {
        const rec = curr.rawRecord;
        if (!rec) return;
        const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
        const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
        const dayEarnings = calculateEarnings(
          curr.hours,
          curr.overtime,
          selectedEmp.hourlyRate,
          settings?.overtimeRateMultiplier || 1.5,
          isIncomplete,
          selectedEmp.monthlySalary,
          isHalfDay
        );
        regularPay += dayEarnings.regularPay + (curr.extraSundayPay || 0);
        overtimePay += dayEarnings.overtimePay;
        totalPay += dayEarnings.totalPay + (curr.extraSundayPay || 0);
      });
      regularPay = Math.round(regularPay * 100) / 100;
      overtimePay = Math.round(overtimePay * 100) / 100;
      totalPay = Math.round(totalPay * 100) / 100;
    } else {
      const earnings = calculateEarnings(
        sumWorkHours,
        totalOvertimeHours,
        selectedEmp.hourlyRate,
        settings?.overtimeRateMultiplier || 1.5
      );
      const extraSundayWages = processedLogs.reduce((sum, curr) => sum + (curr.extraSundayPay || 0), 0);
      regularPay = earnings.regularPay + extraSundayWages;
      overtimePay = earnings.overtimePay;
      totalPay = earnings.totalPay + extraSundayWages;
    }

    const page1Logs = processedLogs.filter(curr => {
      const day = parseInt(curr.dateString.split('-')[2], 10);
      return day <= 16;
    });
    const page2Logs = processedLogs.filter(curr => {
      const day = parseInt(curr.dateString.split('-')[2], 10);
      return day >= 17;
    });

    const getRowHtml = (curr: any) => {
      const rec = curr.rawRecord;
      const hoursStr = curr.hours > 0 ? `${curr.hours.toFixed(2)}h` : '--';
      const otStr = curr.overtime > 0 ? `${curr.overtime.toFixed(2)}h` : '--';
      const statusColor = curr.status === 'Present' ? '#10b981' : 
                          curr.status === 'Half Day' ? '#b45309' :
                          curr.status === 'Late Entry' ? '#f59e0b' :
                          curr.status === 'On Leave' ? '#4f46e5' :
                          curr.status === 'Weekly Off' ? '#64748b' : '#ef4444';

      let dayEarnings = { regularPay: 0, overtimePay: 0, totalPay: 0 };
      if (rec) {
        const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
        const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
        const baseEarnings = calculateEarnings(
          curr.hours,
          curr.overtime,
          selectedEmp.hourlyRate,
          settings?.overtimeRateMultiplier || 1.5,
          isIncomplete,
          selectedEmp.monthlySalary,
          isHalfDay
        );
        dayEarnings = {
          regularPay: baseEarnings.regularPay + (curr.extraSundayPay || 0),
          overtimePay: baseEarnings.overtimePay,
          totalPay: baseEarnings.totalPay + (curr.extraSundayPay || 0)
        };
      } else if (curr.extraSundayPay) {
        dayEarnings = {
          regularPay: curr.extraSundayPay,
          overtimePay: 0,
          totalPay: curr.extraSundayPay
        };
      }

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${formatDateDMY(curr.dateString)}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.dayLabel}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; font-weight: bold; color: ${statusColor}; text-align: center;">${curr.status}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.clockIn}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${curr.clockOut}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-weight: bold; color: #475569;">${rec?.selectedWorkLocation || '--'}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${hoursStr}</td>
          <td style="font-family: monospace; border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #4f46e5;">${otStr}</td>
          <td style="font-family: monospace; font-weight: bold; border: 1px solid #e2e8f0; padding: 8px; text-align: right; color: #1e3a8a;">₹${dayEarnings.totalPay.toFixed(2)}</td>
        </tr>
      `;
    };

    const page1Rows = page1Logs.map(getRowHtml).join('');
    const page2Rows = page2Logs.map(getRowHtml).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Statement - ${selectedEmp.name} - ${friendlyMonth}</title>
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
      grid-template-cols: repeat(5, 1fr);
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
    .print-only-header {
      display: none;
    }
    .print-page2-spacer {
      display: none;
    }
    @media print {
      @page {
        margin-top: 15mm !important;
        margin-bottom: 15mm !important;
        margin-left: 15mm !important;
        margin-right: 15mm !important;
      }
      body {
        background: white;
        margin: 0;
        padding: 0;
      }
      .container {
        border-radius: 0;
        box-shadow: none;
        border: none;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
      .print-banner {
        display: none !important;
      }
      .print-only-header {
        display: block !important;
      }
      /* Compact styling for print to squeeze everything into exactly 2 pages */
      .header {
        display: none !important;
      }
      h3 {
        margin-top: 15px !important;
        margin-bottom: 6px !important;
        font-size: 11px !important;
      }
      .stat-card {
        padding: 6px 4px !important;
        border-radius: 6px !important;
      }
      .stat-lbl {
        font-size: 8px !important;
        margin-bottom: 2px !important;
      }
      .stat-val {
        font-size: 13px !important;
      }
      th {
        padding: 5px 3px !important;
        font-size: 8px !important;
      }
      td {
        padding: 4px 3px !important;
        font-size: 8.5px !important;
      }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .meta-table {
        margin-bottom: 12px !important;
        padding: 10px !important;
        border-spacing: 6px !important;
      }
      .stats-table {
        margin-bottom: 12px !important;
        border-spacing: 6px 0 !important;
      }
      .payout-table {
        margin-bottom: 12px !important;
        border-spacing: 6px 0 !important;
      }
      .signatures-table {
        margin-top: 25px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Beautiful Corporate Header (Printed Page 1) -->
    <div class="print-only-header">
      <table style="width: 100%; border: none; margin-bottom: 8px; border-collapse: collapse; background: transparent;">
        <tr style="background: transparent;">
          <td style="border: none; padding: 0 0 6px 0; font-family: sans-serif; font-size: 12px; font-weight: 850; color: #0f172a; text-align: left; vertical-align: middle; line-height: 1.2;">
            <div style="font-size: 14px; font-weight: 950; letter-spacing: -0.01e; color: #0f172a;">${companyName}</div>
            <span style="font-size: 9.5px; font-weight: bold; color: #475569; display: block; margin-top: 3px; letter-spacing: 0.05em; text-transform: uppercase;">Employee Attendance & Wage Statement</span>
          </td>
          <td style="border: none; padding: 0 0 6px 0; font-family: sans-serif; font-size: 9.5px; font-weight: bold; color: #334155; text-align: right; vertical-align: middle; line-height: 1.35;">
            <div>Statement Period: <span style="color: #0f172a;">${friendlyMonth}</span></div>
            <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Generated On: ${printedOn}</div>
          </td>
        </tr>
      </table>
      <div style="border-bottom: 2px solid #0f172a; margin-bottom: 18px; width: 100%;"></div>
    </div>

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

    <table class="meta-table" style="width: 100%; border: none; border-collapse: separate; border-spacing: 12px; margin-bottom: 25px; background: #f1f5f9; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; table-layout: fixed;">
      <tr style="background: transparent;">
        <td style="border: none; padding: 0; vertical-align: top; width: 35%;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Employee Name</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.name}</div>
        </td>
        <td style="border: none; padding: 0; vertical-align: top; width: 25%;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Employee ID</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.id}</div>
        </td>
        <td style="border: none; padding: 0; vertical-align: top; width: 40%;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Department Unit</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.department}</div>
        </td>
      </tr>
      <tr style="background: transparent;">
        <td style="border: none; padding: 0; vertical-align: top;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Designation / Role</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.designation || 'Staff'}</div>
        </td>
        <td style="border: none; padding: 0; vertical-align: top;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Joined Date</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.joinedDate}</div>
        </td>
        <td style="border: none; padding: 0; vertical-align: top;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Monthly Fixed Salary</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${selectedEmp.monthlySalary ? `₹${selectedEmp.monthlySalary.toFixed(2)}/mo` : 'N/A'} <span style="font-weight: normal; color: #64748b; font-size: 11px;">(OT: ₹${selectedEmp.hourlyRate.toFixed(2)}/hr)</span></div>
        </td>
      </tr>
    </table>

    <table class="stats-table" style="width: 100%; border: none; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 25px; table-layout: fixed;">
      <tr style="background: transparent;">
        <td style="border: none; padding: 0; background: transparent; width: 20%;">
          <div class="stat-card">
            <div class="stat-lbl">Days Present</div>
            <div class="stat-val" style="color: #10b981;">${presentDaysCount} days</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 20%;">
          <div class="stat-card">
            <div class="stat-lbl">Half Days</div>
            <div class="stat-val" style="color: #b45309;">${halfDaysCount} days</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 20%;">
          <div class="stat-card">
            <div class="stat-lbl">Days Absent</div>
            <div class="stat-val" style="color: #ef4444;">${absentDaysCount} days</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 20%;">
          <div class="stat-card">
            <div class="stat-lbl">Active Leave</div>
            <div class="stat-val" style="color: #4f46e5;">${leavesCount} days</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 20%;">
          <div class="stat-card">
            <div class="stat-lbl">Total Work Hours</div>
            <div class="stat-val" style="color: #0d1e3d;">${sumWorkHours.toFixed(1)} hrs</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="payout-table" style="width: 100%; border: none; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 25px; table-layout: fixed;">
      <tr style="background: transparent;">
        <td style="border: none; padding: 0; background: transparent; width: 33.33%;">
          <div class="stat-card">
            <div class="stat-lbl">Standard Hours Pay</div>
            <div class="stat-val">₹${regularPay.toFixed(2)}</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 33.33%;">
          <div class="stat-card">
            <div class="stat-lbl">Overtime Compensation</div>
            <div class="stat-val" style="color: #4f46e5;">₹${overtimePay.toFixed(2)}</div>
          </div>
        </td>
        <td style="border: none; padding: 0; background: transparent; width: 33.33%;">
          <div class="stat-card" style="background: #e0f2fe; border-color: #bae6fd;">
            <div class="stat-lbl">Calculated Payout</div>
            <div class="stat-val" style="color: #0369a1; font-size: 16px; font-weight: 900;">₹${totalPay.toFixed(2)}</div>
          </div>
        </td>
      </tr>
    </table>

    <h3 style="font-size: 13px; text-transform: uppercase; color: #334155; margin-bottom: 12px; margin-top: 30px; letter-spacing: 0.05em;">Shift Logs & Punch Records</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th>Status</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>Work Location</th>
          <th>Worked Hours</th>
          <th>Overtime Hours</th>
          <th>Wage (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${page1Rows}
      </tbody>
    </table>

    ${page2Logs.length > 0 ? `
      <!-- Elegant Page Break -->
      <div style="page-break-before: always; break-before: page; height: 1px;"></div>
      
      <!-- Beautiful Corporate Header (Printed Page 2) -->
      <div class="print-only-header">
        <table style="width: 100%; border: none; margin-bottom: 8px; border-collapse: collapse; background: transparent;">
          <tr style="background: transparent;">
            <td style="border: none; padding: 0 0 6px 0; font-family: sans-serif; font-size: 12px; font-weight: 850; color: #0f172a; text-align: left; vertical-align: middle; line-height: 1.2;">
              <div style="font-size: 14px; font-weight: 950; letter-spacing: -0.01e; color: #0f172a;">${companyName}</div>
              <span style="font-size: 9.5px; font-weight: bold; color: #475569; display: block; margin-top: 3px; letter-spacing: 0.05em; text-transform: uppercase;">Employee Attendance & Wage Statement (Continued)</span>
            </td>
            <td style="border: none; padding: 0 0 6px 0; font-family: sans-serif; font-size: 9.5px; font-weight: bold; color: #334155; text-align: right; vertical-align: middle; line-height: 1.35;">
              <div>Statement Period: <span style="color: #0f172a;">${friendlyMonth}</span></div>
              <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Generated On: ${printedOn}</div>
            </td>
          </tr>
        </table>
        <div style="border-bottom: 2px solid #0f172a; margin-bottom: 18px; width: 100%;"></div>
      </div>
      
      <h3 style="font-size: 12px; text-transform: uppercase; color: #334155; margin-bottom: 8px; margin-top: 10px; letter-spacing: 0.05em;">Shift Logs & Punch Records (Continued)</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Status</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Work Location</th>
            <th>Worked Hours</th>
            <th>Overtime Hours</th>
            <th>Wage (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${page2Rows}
        </tbody>
      </table>
    ` : ''}

    <table class="signatures-table" style="width: 100%; border: none; border-collapse: collapse; margin-top: 50px; background: transparent;">
      <tr style="background: transparent;">
        <td style="width: 45%; border: none; padding: 0; background: transparent;">
          <div style="border-top: 1px dashed #cbd5e1; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; color: #475569;">
            Employee Signature
          </div>
        </td>
        <td style="width: 10%; border: none; padding: 0; background: transparent;"></td>
        <td style="width: 45%; border: none; padding: 0; background: transparent;">
          <div style="border-top: 1px dashed #cbd5e1; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; color: #475569;">
            Authorized Representative Sign / Stamp
          </div>
        </td>
      </tr>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const docName = `Attendance_Statement_${selectedEmp.id}_${selectedStatementMonth}.html`;
    link.setAttribute('download', docName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Triggering visual refresh
  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const todayStr = getLocalDateString();

  // Calculations for Today
  const todayAttendance = attendance.filter(rec => rec.date === todayStr);
  const activeEmployees = employees.filter(emp => emp.status === 'Active');

  const totalEmployeesPresentToday = todayAttendance.filter(rec => {
    // Present includes anyone who has entry time or entry time 2 and is not absent
    return (rec.entryTime || rec.entryTime2) && !rec.status.includes('Absent');
  }).length;

  const totalOnLunchToday = todayAttendance.filter(rec => {
    const isOnLunch = 
      rec.status.toLowerCase().includes('lunch') || 
      (rec.lunchOut && rec.lunchOut !== '--:--' && (!rec.lunchIn || rec.lunchIn === '--:--'));
    return isOnLunch;
  }).length;

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
      
      const inTime = todayRec.entryTime || todayRec.entryTime2;
      if (inTime && inTime !== '--:--') {
        const assignedShift = emp.assignedShift || 'General Shift';
        const shiftConfig = getShiftConfig(assignedShift);
        const inDiff = minutesDiffFromStart(inTime, shiftConfig.start);
        
        const isLateCheckIn = inDiff > 45 || (settings.workStartHour && inTime > settings.workStartHour);
        if (isLateCheckIn && !status.includes('Late Entry') && !status.toLowerCase().includes('leave')) {
          if (status === 'Present') {
            status = 'Late Entry';
          } else if (status === 'Active') {
            status = 'Late Entry, Active';
          } else if (status === 'On Lunch') {
            status = 'Late Entry, On Lunch';
          } else if (status === 'On Dinner') {
            status = 'Late Entry, On Dinner';
          } else {
            status = `Late Entry, ${status}`;
          }
        }
      }

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
    if (statusFilter === 'LUNCH') {
      const isOnLunch = 
        item.status.toLowerCase().includes('lunch') || 
        (item.lunchOut && item.lunchOut !== '--:--' && (!item.lunchIn || item.lunchIn === '--:--'));
      return matchSearch && isOnLunch;
    }
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
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Admin Monthly Statement Downloader */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-indigo-50/70 p-3 sm:py-1.5 sm:px-3 border border-indigo-100 rounded-xl shadow-2xs w-full lg:w-auto">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800 font-mono hidden md:inline-block">Statement Builder:</span>
            <select
              value={selectedStatementEmpId}
              onChange={(e) => setSelectedStatementEmpId(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer sm:min-w-[130px] text-center"
            >
              <option value="">Select Employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <input
              type="month"
              value={selectedStatementMonth}
              onChange={(e) => setSelectedStatementMonth(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer text-slate-700 font-semibold sm:min-w-[110px] text-center"
            />
            <button
              onClick={handleDownloadAdminStatement}
              disabled={isAdminGeneratingPdf}
              className={`w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 sm:py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                isAdminGeneratingPdf ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              title="Download Statement"
            >
              {isAdminGeneratingPdf ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"></span>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>Download Statement</span>
                </>
              )}
            </button>
          </div>

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

      {/* 📄 INVISIBLE PDF COMPILATION CONTAINER FOR PIXEL-PERFECT EXPORTS */}
      {selectedStatementEmpId && selectedStatementMonth && (() => {
        const selectedEmp = employees.find(emp => emp.id === selectedStatementEmpId);
        if (!selectedEmp) return null;
        
        const empLogs = attendance.filter(rec => rec.employeeId === selectedStatementEmpId && rec.date.startsWith(selectedStatementMonth));
        const processedLogs = getProcessedLogsForEmployee(empLogs, selectedEmp, selectedStatementMonth, settings);
        
        const presentDaysCount = processedLogs.filter(l => ['Present', 'Late Entry', 'Night Shift'].includes(l.status)).length;
        const halfDaysCount = processedLogs.filter(l => l.status === 'Half Day').length;
        const absentDaysCount = processedLogs.filter(l => l.status === 'Absent').length;
        const leavesCount = processedLogs.filter(l => l.status === 'On Leave').length;
        
        const sumWorkHours = processedLogs.reduce((acc, current) => {
          const rec = current.rawRecord;
          if (!rec) return acc;
          const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
          if (isIncomplete || current.hours < 3) return acc;
          return acc + current.hours;
        }, 0);

        const totalOvertimeHours = processedLogs.reduce((acc, curr) => {
          const rec = curr.rawRecord;
          if (!rec) return acc;
          const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
          if (isIncomplete || curr.hours < 3) return acc;
          return acc + curr.overtime;
        }, 0);

        let regularPay = 0;
        let overtimePay = 0;
        let totalPay = 0;

        if (selectedEmp.monthlySalary && selectedEmp.monthlySalary > 0) {
          processedLogs.forEach(curr => {
            const rec = curr.rawRecord;
            if (!rec) return;
            const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
            const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
            const dayEarnings = calculateEarnings(
              curr.hours,
              curr.overtime,
              selectedEmp.hourlyRate,
              settings?.overtimeRateMultiplier || 1.5,
              isIncomplete,
              selectedEmp.monthlySalary,
              isHalfDay
            );
            regularPay += dayEarnings.regularPay + (curr.extraSundayPay || 0);
            overtimePay += dayEarnings.overtimePay;
            totalPay += dayEarnings.totalPay + (curr.extraSundayPay || 0);
          });
          regularPay = Math.round(regularPay * 100) / 100;
          overtimePay = Math.round(overtimePay * 100) / 100;
          totalPay = Math.round(totalPay * 100) / 100;
        } else {
          const earnings = calculateEarnings(
            sumWorkHours,
            totalOvertimeHours,
            selectedEmp.hourlyRate,
            settings?.overtimeRateMultiplier || 1.5
          );
          const extraSundayWages = processedLogs.reduce((sum, curr) => sum + (curr.extraSundayPay || 0), 0);
          regularPay = earnings.regularPay + extraSundayWages;
          overtimePay = earnings.overtimePay;
          totalPay = earnings.totalPay + extraSundayWages;
        }

        const page1LogsEx = processedLogs.slice(0, 15);
        const page2LogsEx = processedLogs.slice(15);

        return (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '824px', pointerEvents: 'none' }}>
            {/* PAGE 1 */}
            <div id="admin-attendance-statement-direct-pdf-page-1" style={{ 
              background: '#ffffff', 
              padding: '40px', 
              width: '800px', 
              height: '1130px', 
              boxSizing: 'border-box', 
              fontFamily: 'sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                {/* Header section */}
                <table style={{ width: '100%', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'left', verticalAlign: 'top' }}>
                        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>
                          {settings?.companyName || 'Calitech Engineering Solutions Pvt. Ltd.'}
                        </h1>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Employee Attendance & Wage Statement
                        </p>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'top', width: '220px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Statement Period</div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#4f46e5', marginTop: '2px' }}>{getFriendlyMonthName(selectedStatementMonth)}</div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                          Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ID Details Card */}
                <table style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', borderCollapse: 'separate', borderSpacing: '12px', textAlign: 'left', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '33.33%' }}>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Employee Name</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>{selectedEmp.name}</div>
                      </td>
                      <td style={{ width: '33.33%' }}>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Employee ID</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#1e293b', marginTop: '2px' }}>{selectedEmp.id}</div>
                      </td>
                      <td style={{ width: '33.33%' }}>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Department & Designation</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
                          {selectedEmp.department} {selectedEmp.designation ? `• ${selectedEmp.designation}` : ''}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Joined Date</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginTop: '2px' }}>{selectedEmp.joinedDate || '--'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Monthly Salary</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
                          {selectedEmp.monthlySalary ? `₹${selectedEmp.monthlySalary.toFixed(2)}/mo` : 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>Overtime Wage</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#4f46e5', marginTop: '2px' }}>
                          ₹{selectedEmp.hourlyRate.toFixed(2)}/hr
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Unified Statement Grid View */}
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '10px', marginTop: '5px', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b', display: 'block' }}>Total Workdays</span>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>{processedLogs.length}</span>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>days</span>
                        </div>
                      </td>

                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#059669', display: 'block' }}>Days Present</span>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>{presentDaysCount}</span>
                          <span style={{ fontSize: '8px', color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace' }}>({processedLogs.length > 0 ? Math.round((presentDaysCount / processedLogs.length) * 100) : 0}%)</span>
                        </div>
                      </td>

                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#b45309', display: 'block' }}>Half Days</span>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#d97706' }}>{halfDaysCount}</span>
                          <span style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 'bold', fontFamily: 'monospace' }}>({processedLogs.length > 0 ? Math.round((halfDaysCount / processedLogs.length) * 100) : 0}%)</span>
                        </div>
                      </td>

                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#ef4444', display: 'block' }}>Days Absent</span>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>{absentDaysCount}</span>
                          <span style={{ fontSize: '8px', color: '#f43f5e', fontWeight: 'bold' }}>{leavesCount} l</span>
                        </div>
                      </td>

                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#6366f1', display: 'block' }}>Log Book Hours</span>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#4f46e5' }}>{sumWorkHours.toFixed(1)}h</span>
                          <span style={{ fontSize: '8px', color: '#94a3b8', fontWeight: '500', fontFamily: 'monospace' }}>acc.</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b', display: 'block' }}>Standard Hours Pay</span>
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', fontFamily: 'monospace' }}>₹{regularPay.toFixed(2)}</span>
                        </div>
                      </td>

                      <td style={{ width: '20%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#6366f1', display: 'block' }}>Overtime Compensation</span>
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4f46e5', fontFamily: 'monospace' }}>₹{overtimePay.toFixed(2)}</span>
                        </div>
                      </td>

                      <td colSpan={3} style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '12px', textAlign: 'left', verticalAlign: 'top', boxShadow: '0 1px 3px rgba(14,165,233,0.05)' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#0284c7', display: 'block' }}>Calculated Payout (Net Pay)</span>
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '20px', fontWeight: '900', color: '#0369a1', fontFamily: 'monospace' }}>₹{totalPay.toFixed(2)}</span>
                          <span style={{ fontSize: '9px', color: '#0284c7', fontWeight: '600' }}>(Estimate for {getFriendlyMonthName(selectedStatementMonth)})</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Attendance list days 1-15 */}
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.025em' }}>Attendance Log (Days 1 - 15)</h3>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Day</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Entry</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Exit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Work Location</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Hours</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Overtime</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Wage (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page1LogsEx.map((curr) => {
                        const rec = curr.rawRecord;
                        const statusColor = curr.status === 'Present' ? '#059669' : 
                                            curr.status === 'Half Day' ? '#b45309' :
                                            curr.status === 'Late Entry' ? '#d97706' :
                                            curr.status === 'On Leave' ? '#4f46e5' :
                                            curr.status === 'Weekly Off' ? '#64748b' : '#dc2626';

                        let dayEarnings = { totalPay: 0 };
                        if (rec) {
                          const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
                          const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
                          const baseEarnings = calculateEarnings(
                            curr.hours,
                            curr.overtime,
                            selectedEmp.hourlyRate,
                            settings?.overtimeRateMultiplier || 1.5,
                            isIncomplete,
                            selectedEmp.monthlySalary,
                            isHalfDay
                          );
                          dayEarnings = {
                            totalPay: baseEarnings.totalPay + (curr.extraSundayPay || 0)
                          };
                        } else if (curr.extraSundayPay) {
                          dayEarnings = {
                            totalPay: curr.extraSundayPay
                          };
                        }

                        return (
                          <tr key={curr.dateString} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatDateDMY(curr.dateString)}</td>
                            <td style={{ padding: '6px 12px', color: '#64748b' }}>{curr.dayLabel}</td>
                            <td style={{ padding: '6px 12px', fontWeight: 'bold', color: statusColor }}>{curr.status}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{curr.clockIn}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{curr.clockOut}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>{rec?.selectedWorkLocation || '--'}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#334155' }}>
                              {curr.hours > 0 ? `${curr.hours.toFixed(2)}h` : '--'}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#4f46e5' }}>
                              {curr.overtime > 0 ? `${curr.overtime.toFixed(1)}h` : '--'}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                              ₹{dayEarnings.totalPay.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                <span>{settings?.companyName || 'Calitech Engineering Solutions Pvt. Ltd.'} - Monthly Statement</span>
                <span>Page 1 of 2</span>
              </div>
            </div>

            {/* PAGE 2 */}
            <div id="admin-attendance-statement-direct-pdf-page-2" style={{ 
              background: '#ffffff', 
              padding: '40px', 
              width: '800px', 
              height: '1130px', 
              boxSizing: 'border-box', 
              fontFamily: 'sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                {/* Header section repeated */}
                <table style={{ width: '100%', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'left', verticalAlign: 'top' }}>
                        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>
                          {settings?.companyName || 'Calitech Engineering Solutions Pvt. Ltd.'}
                        </h1>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Employee Attendance & Wage Statement
                        </p>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'top', width: '220px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Statement Period</div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#4f46e5', marginTop: '2px' }}>{getFriendlyMonthName(selectedStatementMonth)}</div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                          Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Attendance list days 16 - end */}
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.025em' }}>Attendance Log (Days 16 - End)</h3>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Day</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Entry</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Exit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Work Location</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Hours</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Overtime</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Wage (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page2LogsEx.map((curr) => {
                        const rec = curr.rawRecord;
                        const statusColor = curr.status === 'Present' ? '#059669' : 
                                            curr.status === 'Half Day' ? '#b45309' :
                                            curr.status === 'Late Entry' ? '#d97706' :
                                            curr.status === 'On Leave' ? '#4f46e5' :
                                            curr.status === 'Weekly Off' ? '#64748b' : '#dc2626';

                        let dayEarnings = { totalPay: 0 };
                        if (rec) {
                          const isIncomplete = !!((rec.entryTime && !rec.exitTime) || (rec.entryTime2 && !rec.exitTime2));
                          const isHalfDay = rec.status ? rec.status.includes('Half Day') : false;
                          const baseEarnings = calculateEarnings(
                            curr.hours,
                            curr.overtime,
                            selectedEmp.hourlyRate,
                            settings?.overtimeRateMultiplier || 1.5,
                            isIncomplete,
                            selectedEmp.monthlySalary,
                            isHalfDay
                          );
                          dayEarnings = {
                            totalPay: baseEarnings.totalPay + (curr.extraSundayPay || 0)
                          };
                        } else if (curr.extraSundayPay) {
                          dayEarnings = {
                            totalPay: curr.extraSundayPay
                          };
                        }

                        return (
                          <tr key={curr.dateString} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatDateDMY(curr.dateString)}</td>
                            <td style={{ padding: '6px 12px', color: '#64748b' }}>{curr.dayLabel}</td>
                            <td style={{ padding: '6px 12px', fontWeight: 'bold', color: statusColor }}>{curr.status}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{curr.clockIn}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{curr.clockOut}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>{rec?.selectedWorkLocation || '--'}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#334155' }}>
                              {curr.hours > 0 ? `${curr.hours.toFixed(2)}h` : '--'}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#4f46e5' }}>
                              {curr.overtime > 0 ? `${curr.overtime.toFixed(1)}h` : '--'}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                              ₹{dayEarnings.totalPay.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signatures section for PDF compliance */}
                <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'separate', borderSpacing: '32px 0' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Employee Signature</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#94a3b8' }}>Verification of logged punch shifts</p>
                      </td>
                      <td style={{ width: '50%', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Authorized Representative</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#94a3b8' }}>{settings?.companyName || 'Calitech Engineering Solutions Pvt. Ltd.'}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                <span>{settings?.companyName || 'Calitech Engineering Solutions Pvt. Ltd.'} - Monthly Statement</span>
                <span>Page 2 of 2</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
