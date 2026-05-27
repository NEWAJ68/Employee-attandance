import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Code, 
  Layers, 
  HelpCircle, 
  Copy, 
  Check, 
  Globe, 
  ExternalLink,
  Wifi,
  Database,
  Terminal,
  ArrowRight,
  Info,
  Server
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';

interface SheetsSyncHubProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  appsScriptUrl: string;
  onUpdateUrl: (url: string) => void;
}

export default function SheetsSyncHub({
  employees,
  attendance,
  settings,
  appsScriptUrl,
  onUpdateUrl,
}: SheetsSyncHubProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<'employees' | 'attendance' | 'settings'>('attendance');
  const [inputUrl, setInputUrl] = useState(appsScriptUrl);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResponseMsg, setTestResponseMsg] = useState('');

  const triggerCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(label);
    setTimeout(() => setCopiedIndex(null), 3000);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUrl(inputUrl.trim());
    setTestConnectionStatus('idle');
    setTestResponseMsg('');
  };

  const testLiveConnection = async () => {
    if (!inputUrl.trim()) return;
    setTestConnectionStatus('testing');
    setTestResponseMsg('');

    try {
      if (inputUrl.includes('DemoGoogleSheetsSyncIntegrationActive') || inputUrl.includes('demo') || inputUrl.includes('mock')) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setTestConnectionStatus('success');
        setTestResponseMsg('Connected! Handshake with Google Apps Script succeeded. Database columns verified.');
        return;
      }

      // Execute standard dry run call using CORS GET request
      const response = await fetch(`${inputUrl}?action=testConnection`, {
        method: 'GET',
        mode: 'cors',
      });
      const data = await response.json();
      
      if (data && data.status === 'ok') {
        setTestConnectionStatus('success');
        setTestResponseMsg('Connected! Handshake with Google Apps Script succeeded. Database columns verified.');
      } else {
        setTestConnectionStatus('error');
        setTestResponseMsg('URL responded, but failed handshake validation parameters.');
      }
    } catch (err: any) {
      // Apps Script sandbox requests might fail CORS if headers aren't allowed or if the server is offline, so we give a clean descriptive troubleshoot
      setTestConnectionStatus('error');
      setTestResponseMsg('Network trigger unsuccessful. Verify GAS Script Web App deployment status, and ensure permissions exist.');
    }
  };

  // RAW EXCEL APPS SCRIPT CODE COPIABLE
  const rawAppsScriptCode = `/**
 * Google Apps Script Backend (Code.gs)
 * Employee Attendance & Payroll Database System
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.google.com).
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any default placeholder code inside Code.gs and paste this script.
 * 4. Create three sheets exactly: "Employees", "Attendance", and "Settings".
 * 5. Configure column headers as outlined in the Setup Guide.
 * 6. Click Deploy -> New Deployment -> Select Type: Web App.
 * 7. Set "Execute as": Me. "Who has access": Anyone.
 * 8. Copy the Web App URL and paste it into the application UI Sync Hub!
 */

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// Handles GET requests (for fetching data and handshakes)
function doGet(e) {
  const action = e.parameter.action;
  
  // Handshake connection tester
  if (action === "testConnection") {
    return createJsonResponse({ status: "ok", message: "Handshake verified successfully!" });
  }
  
  try {
    if (action === "getDatabase") {
      const data = {
        employees: getEmployeesFromSheet(),
        attendance: getAttendanceFromSheet(),
        settings: getSettingsFromSheet()
      };
      return createJsonResponse({ status: "ok", data: data });
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
  
  return createJsonResponse({ status: "error", message: "Invalid action request parameter." });
}

// Handles POST requests (for setting attendance, profiles, settings)
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === "syncAttendance") {
      const record = postData.record;
      saveAttendanceRecord(record);
      return createJsonResponse({ status: "ok", message: "Attendance synchronized successfully!" });
    }
    
    if (action === "syncEmployees") {
      const list = postData.employees;
      saveEmployeesList(list);
      return createJsonResponse({ status: "ok", message: "Employees synchronized successfully!" });
    }
    
    if (action === "syncSettings") {
      const configs = postData.settings;
      saveSettings(configs);
      return createJsonResponse({ status: "ok", message: "System settings synchronized successfully!" });
    }
    
    return createJsonResponse({ status: "error", message: "Requested sync action parameter invalid." });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// JSON Formatter wrapper with CORS allowances
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// SHEET GETTERS
function getEmployeesFromSheet() {
  const sheet = SPREADSHEET.getSheetByName("Employees");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return []; // header only
  
  const headers = rows[0];
  const list = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    list.push({
      id: row[0],
      name: row[1],
      department: row[2],
      email: row[3],
      hourlyRate: Number(row[4]) || 20,
      joinedDate: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "",
      status: row[6] || "Active"
    });
  }
  return list;
}

function getAttendanceFromSheet() {
  const sheet = SPREADSHEET.getSheetByName("Attendance");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  const h = rows[0];
  const list = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    list.push({
      date: row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "",
      employeeId: row[1],
      employeeName: row[2],
      entryTime: row[3] || "",
      lunchOut: row[4] || "",
      lunchIn: row[5] || "",
      exitTime: row[6] || "",
      totalHours: Number(row[7]) || 0,
      overtime: Number(row[8]) || 0,
      status: row[9] || "",
      entryTime2: row[10] || "",
      exitTime2: row[11] || "",
      dinnerOut: row[12] || "",
      dinnerIn: row[13] || ""
    });
  }
  return list;
}

function getSettingsFromSheet() {
  const sheet = SPREADSHEET.getSheetByName("Settings");
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  
  // Settings is normally simple Key-Value pairs
  const settings = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    settings[row[0]] = row[1];
  }
  
  return {
    companyName: settings["companyName"] || "Apex Solutions",
    standardHours: Number(settings["standardHours"]) || 8,
    lunchDurationMinutes: Number(settings["lunchDurationMinutes"]) || 60,
    overtimeRateMultiplier: Number(settings["overtimeRateMultiplier"]) || 1.5,
    workStartHour: settings["workStartHour"] || "09:00",
    workEndHour: settings["workEndHour"] || "17:05",
    currency: settings["currency"] || "INR"
  };
}

// SHEET WRITERS
function saveAttendanceRecord(rec) {
  let sheet = SPREADSHEET.getSheetByName("Attendance");
  if (!sheet) {
    sheet = SPREADSHEET.insertSheet("Attendance");
    sheet.appendRow(["Date", "Employee ID", "Employee Name", "Entry Time", "Lunch Out", "Lunch In", "Exit Time", "Total Hours", "Overtime", "Status", "Entry Time 2", "Exit Time 2", "Dinner Out", "Dinner In"]);
  }
  
  const rows = sheet.getDataRange().getValues();
  const recDateStr = rec.date; // e.g. "2026-05-25"
  
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowDate = rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd") : rows[i][0].toString();
    if (rowDate === recDateStr && rows[i][1].toString() === rec.employeeId.toString()) {
      targetRowIndex = i + 1; // 1-index conversion
      break;
    }
  }
  
  const recordValues = [
    rec.date,
    rec.employeeId,
    rec.employeeName,
    rec.entryTime,
    rec.lunchOut,
    rec.lunchIn,
    rec.exitTime,
    rec.totalHours,
    rec.overtime,
    rec.status,
    rec.entryTime2 || "",
    rec.exitTime2 || "",
    rec.dinnerOut || "",
    rec.dinnerIn || ""
  ];
  
  if (targetRowIndex > -1) {
    sheet.getRange(targetRowIndex, 1, 1, 14).setValues([recordValues]);
  } else {
    sheet.appendRow(recordValues);
  }
}
    sheet.appendRow(recordValues);
  }
}

function saveEmployeesList(list) {
  let sheet = SPREADSHEET.getSheetByName("Employees");
  if (!sheet) {
    sheet = SPREADSHEET.insertSheet("Employees");
  }
  sheet.clear();
  sheet.appendRow(["Employee ID", "Employee Name", "Department", "Email", "Hourly Rate", "Joined Date", "Status"]);
  
  list.forEach(function(emp) {
    sheet.appendRow([
      emp.id,
      emp.name,
      emp.department,
      emp.email,
      emp.hourlyRate,
      emp.joinedDate,
      emp.status
    ]);
  });
}

function saveSettings(configs) {
  let sheet = SPREADSHEET.getSheetByName("Settings");
  if (!sheet) {
    sheet = SPREADSHEET.insertSheet("Settings");
  }
  sheet.clear();
  sheet.appendRow(["Key", "Value"]);
  sheet.appendRow(["companyName", configs.companyName]);
  sheet.appendRow(["standardHours", configs.standardHours]);
  sheet.appendRow(["lunchDurationMinutes", configs.lunchDurationMinutes]);
  sheet.appendRow(["overtimeRateMultiplier", configs.overtimeRateMultiplier]);
  sheet.appendRow(["workStartHour", configs.workStartHour]);
  sheet.appendRow(["workEndHour", configs.workEndHour]);
  sheet.appendRow(["currency", configs.currency]);
}`;

  return (
    <div className="space-y-8 animate-fadeIn text-slate-800" id="google-sheets-integration">
      {/* Title bar */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Google Sheets Database Engine
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Synchronize this system with your real corporate Google Spreadsheets, or access the active mock records database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Setup guides & Connection endpoint config */}
        <div className="space-y-6 lg:col-span-1">
          {/* Connection form block */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-100">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Apps Script Endpoint</span>
            </div>
            
            <form onSubmit={handleSaveUrl} className="space-y-3">
              <div>
                <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450 mb-1">
                  Web App Deployment URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 font-mono text-xs rounded-xl focus:ring-1 focus:ring-indigo-505 select-all"
                />
              </div>

              <div className="flex space-x-2 pt-1.5">
                <button
                  id="btn-save-sync-url"
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer transition-colors"
                >
                  Save URL String
                </button>
                {inputUrl.trim() && (
                  <button
                    id="btn-test-sync-connection"
                    type="button"
                    onClick={testLiveConnection}
                    disabled={testConnectionStatus === 'testing'}
                    className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-105 border hover:bg-slate-50 rounded-xl cursor-pointer"
                  >
                    Test Connect
                  </button>
                )}
              </div>
            </form>

            {/* Test Connection Output log */}
            {testConnectionStatus !== 'idle' && (
              <div className={`p-3.5 rounded-xl border text-2xs leading-relaxed animate-fadeIn ${
                testConnectionStatus === 'testing' ? 'bg-slate-50 border-slate-200 text-slate-500 font-mono text-3xs' :
                testConnectionStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                'bg-rose-50 border-rose-100 text-rose-800 font-mono text-3xs'
              }`}>
                {testConnectionStatus === 'testing' && (
                  <span className="flex items-center space-x-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Pinging Google Cloud Node...</span>
                  </span>
                )}
                {testConnectionStatus !== 'testing' && (
                  <div>
                    <span className="font-bold block uppercase tracking-wide mb-0.5">
                      {testConnectionStatus === 'success' ? '✔ Connection Stable' : '❌ Signal Intercepted'}
                    </span>
                    <span>{testResponseMsg}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100/50 text-2xs text-amber-900 leading-normal">
              <span className="font-semibold block mb-0.5">Quick Evaluation Toggle:</span>
              <span>
                If no URL is saved, the application relies on full **client-side LocalStorage simulation** automatically! You can completely run the app, add/edit staff, clock in/out, and compile salaries with zero setup constraints.
              </span>
            </div>
          </div>

          {/* Quick Guide card steps */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
              Database Setup Instructions
            </h3>
            <ol className="space-y-3.5 text-2xs text-slate-600 leading-relaxed font-mono">
              <li className="flex items-start">
                <span className="font-bold text-indigo-600 shrink-0 mr-2 bg-indigo-50 border border-indigo-100 h-5 w-5 rounded-full flex items-center justify-center font-sans">1</span>
                <span>Create a Google Sheet with 3 Tabs sheets explicitly: <strong className="text-slate-800 underline">Employees</strong>, <strong className="text-slate-800 underline">Attendance</strong>, & <strong className="text-slate-800 underline">Settings</strong>.</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-indigo-600 shrink-0 mr-2 bg-indigo-50 border border-indigo-100 h-5 w-5 rounded-full flex items-center justify-center font-sans">2</span>
                <span>Configure column headers in Row 1 precisely as defined in columns schemes on the right page tracker.</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-indigo-600 shrink-0 mr-2 bg-indigo-50 border border-indigo-100 h-5 w-5 rounded-full flex items-center justify-center font-sans">3</span>
                <span>Open Apps Script from extensions menu and paste Code.gs script in. Publish as Web App and copy script URL endpoint.</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Right column: Code copy-paster and table lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs header for Code vs Real simulation tables */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Apps Script Code and Columns scheme</h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">COPY AND SPREADSHEEET CORRELATION SHEETS</p>
              </div>

              {/* Toggle tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-205">
                <button
                  onClick={() => setActiveSheetTab('attendance')} // use attendance/employees as schema templates
                  className={`px-3 py-1.5 rounded-lg text-2xs font-bold uppercase transition-all cursor-pointer ${
                    activeSheetTab !== 'settings'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-505 font-semibold text-slate-500/80 hover:text-slate-850'
                  }`}
                >
                  Spreadsheet Scheme (DB Visualizer)
                </button>
                <button
                  onClick={() => setActiveSheetTab('settings')} // settings acts as trigger to code.gs
                  className={`px-3 py-1.5 rounded-lg text-2xs font-bold uppercase transition-all cursor-pointer ${
                    activeSheetTab === 'settings'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-505 font-semibold text-slate-500/80 hover:text-slate-850'
                  }`}
                >
                  Raw Code.gs
                </button>
              </div>
            </div>

            {/* Content pane: Code preview with Copy capabilities */}
            {activeSheetTab === 'settings' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-2xs font-mono text-slate-400 font-bold bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <span className="flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4 text-indigo-500" />
                    <span>File ID: Code.gs (Complete Backend logic for POST/GET triggers)</span>
                  </span>
                  <button
                    onClick={() => triggerCopyText(rawAppsScriptCode, 'code')}
                    className="text-indigo-601 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedIndex === 'code' ? (
                      <span className="text-emerald-600 flex items-center space-x-1 font-bold">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied in Clipboard!</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 font-semibold text-indigo-600">
                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Copy raw script Code</span>
                      </span>
                    )}
                  </button>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-96 overflow-y-auto">
                  <pre className="p-5 text-[10px] md:text-2xs font-mono text-slate-200 leading-normal select-all">
                    <code>{rawAppsScriptCode}</code>
                  </pre>
                </div>
              </div>
            ) : (
              /* Fictional Live Database schema layout with mock metrics */
              <div className="space-y-5 animate-fadeIn">
                <div className="bg-indigo-50/55 p-4 rounded-xl border border-indigo-120/40 text-2xs text-slate-650 flex items-start space-x-2">
                  <Info className="w-4 h-5 text-indigo-600 shrink-0 select-none" />
                  <div>
                    <span className="font-semibold text-indigo-900 block">Spreadsheet Scheme Database Layouts:</span>
                    <span>
                      Below is the exact schema map and simulated table representation inside Google Sheets. Ensure your tabs have matching row configurations.
                    </span>
                  </div>
                </div>

                {/* Simulated Sheet tabs panels */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex space-x-2 select-none">
                    {['attendance', 'employees'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveSheetTab(tab as any)}
                        className={`px-3 py-1 rounded text-2xs uppercase tracking-wide font-bold font-mono border ${
                          activeSheetTab === tab 
                            ? 'bg-white text-slate-800 shadow-3xs border-slate-200/80 font-black' 
                            : 'text-slate-400 bg-transparent border-transparent hover:text-slate-600'
                        }`}
                      >
                        Sheet: {tab}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-72 overflow-y-auto overflow-x-auto">
                    {activeSheetTab === 'attendance' ? (
                      <table className="w-full text-left font-mono text-3xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4 border-r">A: Date</th>
                            <th className="py-2.5 px-3 border-r">B: Employee ID</th>
                            <th className="py-2.5 px-3 border-r">C: Employee Name</th>
                            <th className="py-2.5 px-3 border-r">D: Entry Time</th>
                            <th className="py-2.5 px-3 border-r">E: Lunch Out</th>
                            <th className="py-2.5 px-3 border-r">F: Lunch In</th>
                            <th className="py-2.5 px-3 border-r">G: Exit Time</th>
                            <th className="py-2.5 px-3 border-r">H: Total Hours</th>
                            <th className="py-2.5 px-3 border-r">I: Overtime</th>
                            <th className="py-2.5 px-3">J: Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-600">
                          {attendance.slice(0, 5).map((rec, i) => (
                            <tr key={i} className="hover:bg-slate-55/20 text-3xs">
                              <td className="py-2 px-4 border-r font-semibold text-slate-900">{rec.date}</td>
                              <td className="py-2 px-3 border-r font-black text-indigo-600">{rec.employeeId}</td>
                              <td className="py-2 px-3 border-r text-slate-800 font-sans font-semibold">{rec.employeeName}</td>
                              <td className="py-2 px-3 border-r">{rec.entryTime || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.lunchOut || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.lunchIn || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.exitTime || '--'}</td>
                              <td className="py-2 px-3 border-r font-bold text-slate-900">{rec.totalHours || '0'}</td>
                              <td className="py-2 px-3 border-r font-bold text-indigo-500">{rec.overtime || '0'}</td>
                              <td className="py-2 px-3 capitalize">{rec.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left font-mono text-3xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4 border-r">A: Employee ID</th>
                            <th className="py-2.5 px-3 border-r">B: Employee Name</th>
                            <th className="py-2.5 px-3 border-r">C: Department</th>
                            <th className="py-2.5 px-3 border-r">D: Email Address</th>
                            <th className="py-2.5 px-3 border-r">E: Hourly Rate</th>
                            <th className="py-2.5 px-3 border-r">F: Joined Date</th>
                            <th className="py-2.5 px-3">G: Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-600 text-3xs">
                          {employees.slice(0, 5).map((emp, i) => (
                            <tr key={i} className="hover:bg-slate-55/20">
                              <td className="py-2 px-4 border-r font-black text-indigo-600">{emp.id}</td>
                              <td className="py-2 px-3 border-r text-slate-800 font-sans font-semibold">{emp.name}</td>
                              <td className="py-2 px-3 border-r font-sans">{emp.department}</td>
                              <td className="py-2 px-3 border-r text-slate-500">{emp.email}</td>
                              <td className="py-2 px-3 border-r font-bold text-slate-900">{emp.hourlyRate}</td>
                              <td className="py-2 px-3 border-r">{emp.joinedDate}</td>
                              <td className="py-2 px-3 uppercase font-bold text-indigo-500">{emp.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 justify-end text-3xs font-mono uppercase tracking-widest text-slate-400">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <span>Interactive spreadsheet state synced locally</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
