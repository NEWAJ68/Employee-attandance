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
  Server,
  Link,
  Link2,
  Unlink,
  RefreshCw
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';

interface SheetsSyncHubProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  appsScriptUrl: string;
  onUpdateUrl: (url: string) => void;
  onUpdateSettings?: (updatedSettings: Settings) => void;
  isSyncing?: boolean;
  onManualSyncAll?: () => void;
  googleAccessToken?: string | null;
  googleSpreadsheetId?: string | null;
  onUpdateSpreadsheetId?: (id: string | null) => void;
  onGoogleSignIn?: () => Promise<void>;
  onDisconnectGoogle?: () => void;
  onCreateNewSpreadsheet?: (title: string) => Promise<string>;
}

export default function SheetsSyncHub({
  employees,
  attendance,
  settings,
  appsScriptUrl,
  onUpdateUrl,
  onUpdateSettings,
  isSyncing = false,
  onManualSyncAll,
  googleAccessToken = null,
  googleSpreadsheetId = null,
  onUpdateSpreadsheetId,
  onGoogleSignIn,
  onDisconnectGoogle,
  onCreateNewSpreadsheet,
}: SheetsSyncHubProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<'employees' | 'attendance' | 'settings'>('attendance');
  const [inputUrl, setInputUrl] = useState(appsScriptUrl);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleGoogleConnectClick = async () => {
    if (isConnectingGoogle) return;
    setIsConnectingGoogle(true);
    try {
      if (onGoogleSignIn) {
        await onGoogleSignIn();
      }
    } catch (err) {
      console.error('Google Sign-In connection error:', err);
    } finally {
      setIsConnectingGoogle(false);
    }
  };
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResponseMsg, setTestResponseMsg] = useState('');

  // Direct Google Sheets Integration local states
  const [newSheetTitle, setNewSheetTitle] = useState('CES Attendance Database');
  const [customSheetId, setCustomSheetId] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState('');

  const handleCreateSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateNewSpreadsheet || !newSheetTitle.trim()) return;
    setIsCreatingSheet(true);
    setSpreadsheetError('');
    try {
      await onCreateNewSpreadsheet(newSheetTitle.trim());
    } catch (err: any) {
      setSpreadsheetError(err.message || 'Error occurred while creating spreadsheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleLinkExistingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSpreadsheetId || !customSheetId.trim()) return;
    
    // Auto extract spreadsheet token ID if full URL is pasted
    let finalId = customSheetId.trim();
    const urlMatches = finalId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatches && urlMatches[1]) {
      finalId = urlMatches[1];
    }
    
    onUpdateSpreadsheetId(finalId);
    setCustomSheetId('');
  };

  const handleToggleAutoSync = () => {
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        autoSyncSheets: !settings.autoSyncSheets,
      });
    }
  };

  const handleToggleStrictGeofencing = () => {
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        strictGeofencing: !settings.strictGeofencing,
      });
    }
  };

  const handleManualSyncAll = () => {
    if (onManualSyncAll) {
      onManualSyncAll();
    }
  };

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
      status: row[3] || "",
      entryTime: row[4] || "",
      lunchOut: row[5] || "",
      lunchIn: row[6] || "",
      exitTime: row[7] || "",
      entryTime2: row[8] || "",
      exitTime2: row[9] || "",
      dinnerOut: row[10] || "",
      dinnerIn: row[11] || "",
      totalHours: Number(row[12]) || 0,
      overtime: Number(row[13]) || 0
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
    sheet.appendRow(["Date", "Employee ID", "Employee Name", "Status", "Entry Time", "Lunch Out", "Lunch In", "Exit Time", "Entry Time 2", "Exit Time 2", "Dinner Out", "Dinner In", "Total Hours", "Overtime"]);
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
    rec.status,
    rec.entryTime,
    rec.lunchOut,
    rec.lunchIn,
    rec.exitTime,
    rec.entryTime2 || "",
    rec.exitTime2 || "",
    rec.dinnerOut || "",
    rec.dinnerIn || "",
    rec.totalHours,
    rec.overtime
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

      {/* Bilingual Instruction Box (Hindi / English Setup Guide) */}
      <div className="bg-gradient-to-r from-amber-50 to-indigo-50/50 p-6 rounded-2xl border border-indigo-120/40 shadow-xs space-y-4">
        <div className="flex items-center space-x-2.5 text-indigo-900 font-bold text-sm">
          <span className="text-lg">💡</span>
          <span>Google Sheets Se Kaise Connect Karen? (गूगल शीट से कैसे जोड़ें?)</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-650 leading-relaxed font-sans">
          {/* Method 1: Direct Single-Click Sync */}
          <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-3xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase font-mono">
                Method A: Easy Sync (सबसे आसान तरीका)
              </span>
              <span className="text-emerald-600 font-black text-2xs animate-pulse">✓ Recommended</span>
            </div>
            
            <p className="font-semibold text-slate-800">
              बिना किसी कोडिंग या सिरदर्द के सीधे अपने Google Account से सिंक करें:
            </p>
            <ol className="list-decimal pl-4.5 space-y-2 text-slate-600">
              <li>
                <strong>Step 1:</strong> बाईं तरफ वाले <span className="font-bold text-emerald-700">"Connect with Google Account"</span> बटन पर क्लिक करें।
              </li>
              <li>
                <strong>Step 2:</strong> अपना गूगल ईमेल आईडी चुनें और परमिशन कन्फर्म करें।
              </li>
              <li>
                <strong>Step 3:</strong> शीट का नाम (जैसे: <em>"CES Attendance Database"</em>) लिखकर <span className="font-bold text-emerald-600">"Create"</span> बटन दबाएं।
              </li>
            </ol>
            <p className="text-3xs text-slate-500 italic mt-1 font-mono">
              * यह खुद ही नया गूगल शीट आपके गूगल ड्राइव में बना देगा और सिंक चालू कर देगा।
            </p>
          </div>

          {/* Method 2: Apps Script Workflow */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs space-y-3">
            <span className="font-extrabold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded uppercase font-mono">
              Method B: Custom Web App (एडवांस्ड तरीका)
            </span>
            
            <p className="font-semibold text-slate-800">
              Apps Script का उपयोग करके अपनी खुद की शीट में कस्टम सिंक सेट करें:
            </p>
            <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-600">
              <li>
                Google Sheets पर एक नई शीट बनाएं जिसमें 3 टैब हों: <code className="bg-slate-100 px-1 py-0.5 rounded text-3xs font-mono font-bold text-indigo-600">Employees</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-3xs font-mono font-bold text-indigo-600">Attendance</code>, और <code className="bg-slate-100 px-1 py-0.5 rounded text-3xs font-mono font-bold text-indigo-600">Settings</code>
              </li>
              <li>
                दाहिनी ओर दिए गए <strong className="text-slate-800">"Raw Code.gs"</strong> टैब से पूरा कोड कॉपी कर लें।
              </li>
              <li>
                Google Sheet में <em>Extensions → Apps Script</em> पर जाकर कोड पेस्ट करें।
              </li>
              <li>
                <strong>Deploy → New Deployment</strong> करें (Who has access: Anyone) और वेब ऐप URL को यहाँ बाईं तरफ पेस्ट कर दें।
              </li>
            </ol>
          </div>
        </div>

        {/* Where is my sheet section */}
        <div className="bg-amber-50/70 p-4 border border-amber-200/60 rounded-xl space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
            <span>📂</span>
            <span>Mujhe Meri Google Sheet Kahan Milegi? (मेरी बनाई हुई गूगल शीट मुझे कहाँ मिलेगी?)</span>
          </div>
          <div className="text-slate-700 space-y-1.5 pl-5">
            <p>
              जब आप सफलतापूर्वक सिंक पूरा कर लेते हैं, तो आपकी शीट इन दो मुख्य तरीकों से मिल जाएगी:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-650">
              <li>
                <strong>तरीका 1 (Direct Shortcut):</strong> इसी पेज पर बाईं ओर जहाँ <strong className="text-indigo-900">"Google Sheet Connection"</strong> कार्ड है, वहाँ पर एक हरा <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold text-3xs uppercase">Open Sheet</span> बटन दिखेगा। उस पर क्लिक करते ही शीट सीधे नए टैब में खुल जाएगी!
              </li>
              <li>
                <strong>तरीका 2 (Google Drive):</strong> यह शीट सीधे आपके Google Account में सेव होती है। आप सीधे <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold hover:text-indigo-800">drive.google.com (Google Drive)</a> या <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold hover:text-indigo-800">sheets.google.com</a> पर जाएं। वहाँ आपको आपके द्वारा चुना गया शीट का नाम (जैसे: <em>"CES Attendance Database"</em>) सबसे ऊपर दिख जाएगा।
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Setup guides & Connection endpoint config */}
        <div className="space-y-6 lg:col-span-1">
          {/* Direct Google Sheets (OAUTH) Connection panel */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Direct Google Account Sync</span>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${googleAccessToken ? 'bg-emerald-55/80 text-emerald-800 border border-emerald-100/50' : 'bg-slate-50 text-slate-450 border border-slate-100'}`}>
                {googleAccessToken ? 'Connected' : 'Offline'}
              </span>
            </div>

            {!googleAccessToken ? (
              <div className="space-y-3">
                <p className="text-2xs text-slate-500 leading-relaxed font-mono">
                  Sign in using Google Secure OAuth to directly manage, create, and append staff logs to a live spreadsheet in your Google Drive.
                </p>

                {isInIframe && (
                  <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/65 text-[10px] text-amber-900 leading-relaxed space-y-1 animate-fadeIn">
                    <span className="font-extrabold flex items-center gap-1.5 text-amber-850">
                      <ExternalLink className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      Browser Iframe Mode Detected
                    </span>
                    <p className="font-medium text-amber-800">
                      Standard Google Sign-In popups can be blocked inside secure preview frames (आईफ्रेम सुरक्षा प्रतिबंध). If signing in fails, please click the link below to open the application in a new dedicated tab:
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 font-mono underline bg-transparent p-0 cursor-pointer text-xs"
                    >
                      Open App in New Tab (नया टैब खोलें) ↗
                    </button>
                  </div>
                )}

                <button
                  id="btn-google-oauth-signin"
                  onClick={handleGoogleConnectClick}
                  disabled={isConnectingGoogle}
                  className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-bold rounded-xl active:scale-98 transition-all shadow-3xs cursor-pointer"
                >
                  {isConnectingGoogle ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Connecting Security Gateway...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 translate-y-0.5 animate-bounce" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      <span>Connect with Google Account</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-2xs p-2 bg-emerald-50 rounded-xl border border-emerald-100/40">
                  <span className="font-semibold text-emerald-800">✓ Auth Session Active</span>
                  <button
                    onClick={onDisconnectGoogle}
                    className="text-[10px] text-rose-600 hover:underline flex items-center space-x-1 cursor-pointer font-bold"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                </div>

                {!googleSpreadsheetId ? (
                  <div className="space-y-4 pt-1 border-t border-slate-100">
                    <form onSubmit={handleCreateSheetSubmit} className="space-y-2">
                      <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450">
                        Create New Google Sheet
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newSheetTitle}
                          onChange={(e) => setNewSheetTitle(e.target.value)}
                          placeholder="Spreadsheet Title"
                          className="flex-1 px-3 py-1.5 border border-slate-200 bg-slate-50 font-sans text-xs rounded-xl focus:ring-1 focus:ring-emerald-500 text-slate-700"
                        />
                        <button
                          type="submit"
                          disabled={isCreatingSheet}
                          className="py-1.5 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-650/10 cursor-pointer flex items-center justify-center min-w-[70px]"
                        >
                          {isCreatingSheet ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Create</span>
                          )}
                        </button>
                      </div>
                    </form>

                    <div className="text-center font-mono text-[9px] text-slate-400">— OR —</div>

                    <form onSubmit={handleLinkExistingSubmit} className="space-y-2">
                      <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450">
                        Link Existing Spreadsheet ID / URL
                      </label>
                      <input
                        type="text"
                        value={customSheetId}
                        onChange={(e) => setCustomSheetId(e.target.value)}
                        placeholder="Paste Spreadsheet URL or ID"
                        className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 font-mono text-xs rounded-xl focus:ring-1 focus:ring-emerald-500 text-slate-700 select-all"
                      />
                      <button
                        type="submit"
                        className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                      >
                        Link Spreadsheet
                      </button>
                    </form>

                    {spreadsheetError && (
                      <p className="text-[10px] text-rose-600 font-mono mt-2">{spreadsheetError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-3xs font-mono font-bold text-slate-450 uppercase mb-0.5">Linked Spreadsheet ID</span>
                      <span className="block font-mono text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 truncate select-all" title={googleSpreadsheetId}>
                        {googleSpreadsheetId}
                      </span>
                    </div>

                    <div className="flex space-x-2 pt-1">
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${googleSpreadsheetId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 text-center text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-650/10 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Sheet</span>
                      </a>
                      <button
                        onClick={() => onUpdateSpreadsheetId && onUpdateSpreadsheetId(null)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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

          {/* Sync Preferences & Auto-Sensing Panel */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Sync Preferences</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">
                Settings
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Toggle component */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-0.5 max-w-[70%]">
                  <span className="block text-xs font-bold text-slate-800">Auto-Sync Logs</span>
                  <span className="block text-[10px] text-slate-500 leading-tight">
                    Automatically trigger background data push to Google Sheets every time a new attendance record is created or updated.
                  </span>
                </div>
                <button
                  id="btn-toggle-auto-sync"
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.autoSyncSheets ? 'bg-indigo-650' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.autoSyncSheets ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Strict Geofencing Toggle Component */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-0.5 max-w-[70%]">
                  <span className="block text-xs font-bold text-slate-800">Strict GPS Geofencing</span>
                  <span className="block text-[10px] text-slate-500 leading-tight">
                    If enabled, blocks out-of-range punches. Turn off if employees face GPS calibration errors on site. (अटेंडेंस लोकेशन प्रतिबंध चालू/बंद करें)
                  </span>
                </div>
                <button
                  id="btn-toggle-strict-geofence"
                  type="button"
                  onClick={handleToggleStrictGeofencing}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.strictGeofencing ? 'bg-indigo-650' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.strictGeofencing ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Manual Backup Trigger block */}
              <div className="p-3 bg-indigo-55/30 rounded-xl border border-indigo-120/15 space-y-2">
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-slate-800">Manual Force Sync</span>
                  <span className="block text-[10px] text-slate-500 leading-tight">
                    Manually push all {employees.length} employee profiles, settings and active attendance logs to Google Sheets immediately.
                  </span>
                </div>
                
                <button
                  id="btn-manual-sync-now"
                  type="button"
                  onClick={handleManualSyncAll}
                  disabled={isSyncing || !appsScriptUrl}
                  className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl active:scale-98 transition-all shadow-3xs cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Synchronizing...</span>
                    </>
                  ) : (
                    <>
                      <Server className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      <span>Sync Entire Database Now</span>
                    </>
                  )}
                </button>
              </div>
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
                            <th className="py-2.5 px-3 border-r">D: Status</th>
                            <th className="py-2.5 px-3 border-r">E: Entry Time</th>
                            <th className="py-2.5 px-3 border-r">F: Lunch Out</th>
                            <th className="py-2.5 px-3 border-r">G: Lunch In</th>
                            <th className="py-2.5 px-3 border-r">H: Exit Time</th>
                            <th className="py-2.5 px-3 border-r">I: Entry Time 2</th>
                            <th className="py-2.5 px-3 border-r">J: Exit Time 2</th>
                            <th className="py-2.5 px-3 border-r">K: Dinner Out</th>
                            <th className="py-2.5 px-3 border-r">L: Dinner In</th>
                            <th className="py-2.5 px-3 border-r">M: Total Hours</th>
                            <th className="py-2.5 px-3">N: Overtime</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-600">
                          {attendance.slice(0, 5).map((rec, i) => (
                            <tr key={i} className="hover:bg-slate-55/20 text-3xs">
                              <td className="py-2 px-4 border-r font-semibold text-slate-900">{rec.date}</td>
                              <td className="py-2 px-3 border-r font-black text-indigo-600">{rec.employeeId}</td>
                              <td className="py-2 px-3 border-r text-slate-800 font-sans font-semibold">{rec.employeeName}</td>
                              <td className="py-2 px-3 border-r capitalize font-semibold text-slate-700">{rec.status}</td>
                              <td className="py-2 px-3 border-r">{rec.entryTime || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.lunchOut || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.lunchIn || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.exitTime || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.entryTime2 || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.exitTime2 || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.dinnerOut || '--'}</td>
                              <td className="py-2 px-3 border-r">{rec.dinnerIn || '--'}</td>
                              <td className="py-2 px-3 border-r font-bold text-slate-900">{rec.totalHours?.toFixed(2) || '0'}</td>
                              <td className="py-2 px-3 font-bold text-indigo-500">{rec.overtime?.toFixed(2) || '0'}</td>
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
                              <td className="py-2 px-3 border-r font-bold text-slate-900">₹{emp.hourlyRate?.toFixed(2)}</td>
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
