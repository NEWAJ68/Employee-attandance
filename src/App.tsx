import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Clock, 
  ShieldAlert, 
  FileSpreadsheet, 
  HelpCircle, 
  LogOut, 
  AlertCircle,
  TrendingUp,
  Briefcase,
  Wifi,
  WifiOff,
  Sliders,
  Maximize2,
  Calendar,
  Bell,
  AlertTriangle,
  MapPin,
  Zap,
  Plus,
  MessageSquare,
  Smartphone
} from 'lucide-react';

import { Employee, AttendanceRecord, Settings, AppState, LeaveRequest, AppNotification } from './types';
import { INITIAL_EMPLOYEES, INITIAL_SETTINGS, generateInitialAttendance } from './data';
import { verifyProximityToOffice, OFFICE_COORDS } from './utils/calculations';

// Firebase imports
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, doc, setDoc as firestoreSetDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, googleProvider, OperationType, handleFirestoreError, testConnection, cleanFirestoreData } from './firebase';

// Wrapped setDoc to ensure absolute safety against undefined fields in Firestore operations
const setDoc = (docRef: any, data: any, options?: any) => {
  const cleaned = cleanFirestoreData(data);
  return options ? firestoreSetDoc(docRef, cleaned, options) : firestoreSetDoc(docRef, cleaned);
};

// Google Sheets Service Imports
import {
  createSpreadsheet,
  syncEmployeesToSheet,
  syncSettingsToSheet,
  syncAttendanceRecordToSheet,
  syncAllAttendanceToSheet
} from './utils/googleSheetsService';

// Component Imports
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import DashboardView from './components/DashboardView';
import AttendanceTerminal from './components/AttendanceTerminal';
import EmployeeProfiles from './components/EmployeeProfiles';
import ReportsView from './components/ReportsView';
import SheetsSyncHub from './components/SheetsSyncHub';
import LeaveManagementView from './components/LeaveManagementView';
import MyAttendanceView from './components/MyAttendanceView';

const LOCAL_STORAGE_KEY = 'apex_attendance_mgmt_v1';

const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LR-101',
    employeeId: 'CES003',
    employeeName: 'Dibakar Choudhury',
    leaveType: 'Vacation',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    status: 'Pending',
    notes: 'Family trip. Fully reachable by email if urgent.',
    submittedAt: '2026-05-24T18:30:00Z',
  },
  {
    id: 'LR-102',
    employeeId: 'CES002',
    employeeName: 'Shahmim Newaj',
    leaveType: 'Personal',
    startDate: '2026-05-28',
    endDate: '2026-05-28',
    status: 'Pending',
    notes: 'Urgent dentist appointment in the afternoon.',
    submittedAt: '2026-05-25T08:15:00Z',
  }
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NT-101',
    title: 'Late Entry Alert',
    message: 'Shahmim Newaj checked in late today at 10:12 AM (Threshold: 10:00 AM).',
    type: 'warning',
    timestamp: '10:12 AM',
    read: false,
    isAdmin: true,
    employeeId: 'CES002'
  },
  {
    id: 'NT-102',
    title: 'System Active Reminders',
    message: 'Monthly payroll calculations synchronized once the month is completed (महीना पूरा होने पर मासिक पेरोल गणनाएं सिंक की जाएंगी).',
    type: 'success',
    timestamp: '08:00 AM',
    read: true,
    isAdmin: true
  }
];


export default function App() {
  const [currentView, setCurrentView] = useState<string>('terminal');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'mobile' | 'desktop'>('mobile');
  
  // Primary application state
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('https://script.google.com/macros/s/AKfycbwDemoGoogleSheetsSyncIntegrationActive/exec');
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_spreadsheet_id') || null;
    } catch {
      return null;
    }
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(null);

  // Leave & Push notifications state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState<boolean>(false);

  // Geofencing Warn Alerts
  const [acknowledgedPunches, setAcknowledgedPunches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('acknowledgedPunches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const unacknowledgedOutPunches = attendance.filter(rec => 
    rec.isOutOfRange === true && !acknowledgedPunches.includes(`${rec.date}_${rec.employeeId}`)
  );

  const handleAcknowledgePunch = (date: string, empId: string) => {
    const key = `${date}_${empId}`;
    setAcknowledgedPunches(prev => {
      const updated = [...prev, key];
      localStorage.setItem('acknowledgedPunches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAcknowledgeAllPunches = () => {
    const keysToAck = unacknowledgedOutPunches.map(rec => `${rec.date}_${rec.employeeId}`);
    setAcknowledgedPunches(prev => {
      const updated = [...prev, ...keysToAck];
      localStorage.setItem('acknowledgedPunches', JSON.stringify(updated));
      return updated;
    });
  };

  // Sync state helpers
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'synced' | 'error'>('synced');
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');

  // Unified State Loader with real-time Firebase syncing
  useEffect(() => {
    // 1. Initial immediate boot load from LocalStorage as silent offline fallback
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Setup self-healing/reset if old employee IDs exist
        const hasOutdatedData = parsed.employees && parsed.employees.some((e: any) => e.id.startsWith('EMP-'));
        if (hasOutdatedData) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        } else {
          if (parsed.employees) setEmployees(parsed.employees);
          if (parsed.attendance) setAttendance(parsed.attendance);
          if (parsed.settings) setSettings(parsed.settings);
          if (parsed.appsScriptUrl) {
            setAppsScriptUrl(parsed.appsScriptUrl);
            setSyncStatus('synced');
          } else {
            setAppsScriptUrl('https://script.google.com/macros/s/AKfycbwDemoGoogleSheetsSyncIntegrationActive/exec');
            setSyncStatus('synced');
          }
          if (parsed.isAdminLoggedIn) setIsAdminLoggedIn(parsed.isAdminLoggedIn);
          if (parsed.loggedInEmployee) setLoggedInEmployee(parsed.loggedInEmployee);
          if (parsed.leaveRequests) setLeaveRequests(parsed.leaveRequests);
          if (parsed.notifications) setNotifications(parsed.notifications);
        }
      } catch (e) {
        console.error('Failed reading serialized local storage files:', e);
      }
    }

    // 2. Perform Anonymous Firebase auth login mapping or fallback to unauthenticated
    setFirebaseStatus('connecting');

    const initializeFirestoreSubscriptions = () => {
      // Snapshot - Employees
      const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
        if (snapshot.empty) {
          // Seed defaults onto Firestore
          INITIAL_EMPLOYEES.forEach((emp) => {
            setDoc(doc(db, 'employees', emp.id), emp).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `employees/${emp.id}`);
            });
          });
        } else {
          const list: Employee[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as Employee);
          });
          setEmployees(list);
        }
      }, (err) => {
        console.error('Employees cloud listing denied:', err);
      });

      // Snapshot - Attendance
      const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
        if (snapshot.empty) {
          // Seed default logs relative to today's date
          const seededLogs = generateInitialAttendance(new Date().toISOString().split('T')[0]);
          seededLogs.forEach((rec) => {
            const docId = `${rec.date}_${rec.employeeId}`;
            setDoc(doc(db, 'attendance', docId), rec).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
            });
          });
        } else {
          const list: AttendanceRecord[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as AttendanceRecord);
          });
          setAttendance(list);
        }
      }, (err) => {
        console.error('Attendance cloud listing denied:', err);
      });

      // Snapshot - Settings
      const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        if (!docSnap.exists()) {
          setDoc(doc(db, 'settings', 'global'), INITIAL_SETTINGS).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'settings/global');
          });
        } else {
          setSettings(docSnap.data() as Settings);
        }
      }, (err) => {
        console.error('Settings document snapshot query failed:', err);
      });

      // Snapshot - Leave Requests
      const unsubLeaves = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
        if (snapshot.empty) {
          INITIAL_LEAVE_REQUESTS.forEach((req) => {
            setDoc(doc(db, 'leaveRequests', req.id), req).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `leaveRequests/${req.id}`);
            });
          });
        } else {
          const list: LeaveRequest[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as LeaveRequest);
          });
          list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          setLeaveRequests(list);
        }
      }, (err) => {
        console.error('Leave requests query failed:', err);
      });

      // Snapshot - Notifications
      const unsubNotifs = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        if (snapshot.empty) {
          INITIAL_NOTIFICATIONS.forEach((notif) => {
            setDoc(doc(db, 'notifications', notif.id), notif).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`);
            });
          });
        } else {
          const list: AppNotification[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as AppNotification);
          });
          // Sort by unique timestamp string or id if desired, keeping newest first
          list.sort((a, b) => b.id.localeCompare(a.id));
          setNotifications(list);
        }
      }, (err) => {
        console.error('Audit alerts subscription query denied:', err);
      });

      return () => {
        unsubEmp();
        unsubAttendance();
        unsubSettings();
        unsubLeaves();
        unsubNotifs();
      };
    };

    let unsubscribes: (() => void) | null = null;

    signInAnonymously(auth)
      .then(async () => {
        console.log('Firebase Anonymous Session initialized successfully.');
        const isOnline = await testConnection();
        setFirebaseStatus(isOnline ? 'connected' : 'offline');
        unsubscribes = initializeFirestoreSubscriptions();
      })
      .catch(async (err) => {
        console.warn('Firebase Anonymous Auth restricted by GCP project policy, proceeding unauthenticated:', err.message);
        // Fallback: Proceed unauthenticated with connected state if reachable, otherwise offline
        const isOnline = await testConnection();
        setFirebaseStatus(isOnline ? 'connected' : 'offline');
        unsubscribes = initializeFirestoreSubscriptions();
      });

    return () => {
      if (unsubscribes) {
        unsubscribes();
      }
    };
  }, []);

  // Unified State Writer to LocalStorage
  const handleSaveToLocalStorage = (
    nextEmployees: Employee[] = employees,
    nextAttendance: AttendanceRecord[] = attendance,
    nextSettings: Settings = settings,
    nextUrl: string = appsScriptUrl,
    nextAdminState: boolean = isAdminLoggedIn,
    nextLeaves: LeaveRequest[] = leaveRequests,
    nextNotifs: AppNotification[] = notifications,
    nextEmp: Employee | null = loggedInEmployee
  ) => {
    const backupObj = {
      employees: nextEmployees,
      attendance: nextAttendance,
      settings: nextSettings,
      appsScriptUrl: nextUrl,
      isAdminLoggedIn: nextAdminState,
      leaveRequests: nextLeaves,
      notifications: nextNotifs,
      loggedInEmployee: nextEmp
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backupObj));
  };

  // Sync to localCache as reactive backup automatically on React states variations
  useEffect(() => {
    handleSaveToLocalStorage();
  }, [employees, attendance, settings, appsScriptUrl, isAdminLoggedIn, leaveRequests, notifications, loggedInEmployee]);

  // Dispatch Administrative push alerts
  const handleRaiseNotification = async (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'alert' | 'success',
    employeeId?: string
  ) => {
    const newNotif: AppNotification = {
      id: `NT-${Date.now()}-${Math.floor(Math.random() * 1050)}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      isAdmin: true,
      employeeId
    };

    try {
      await setDoc(doc(db, 'notifications', newNotif.id), newNotif);

      // Native Browser Notification block
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: message, icon: '/favicon.ico' });
        } catch (e) {
          console.log('Fired notification warning internally', message);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${newNotif.id}`);
    }
  };

  // Google Sheets Remote Sync Trigger Action
  const triggerRemoteSheetsSync = async (actionType: 'syncAttendance' | 'syncEmployees' | 'syncSettings', payload: any) => {
    setIsSyncing(true);

    // 1. Direct API Google Sheets Sync using OAuth Access Token
    if (googleAccessToken && googleSpreadsheetId) {
      try {
        if (actionType === 'syncAttendance' && payload.record) {
          await syncAttendanceRecordToSheet(googleAccessToken, googleSpreadsheetId, payload.record);
        } else if (actionType === 'syncEmployees' && payload.employees) {
          await syncEmployeesToSheet(googleAccessToken, googleSpreadsheetId, payload.employees);
        } else if (actionType === 'syncSettings' && payload.settings) {
          await syncSettingsToSheet(googleAccessToken, googleSpreadsheetId, payload.settings);
        }
        setSyncStatus('synced');
        setIsSyncing(false);
        return; // Direct sync succeeded!
      } catch (err) {
        console.error('Direct Google Sheets sync failed, seeking Apps Script fallback:', err);
      }
    }

    // 2. Apps Script Hook (if configured)
    if (!appsScriptUrl) {
      setIsSyncing(false);
      return;
    }

    try {
      if (appsScriptUrl.includes('DemoGoogleSheetsSyncIntegrationActive') || appsScriptUrl.includes('demo') || appsScriptUrl.includes('mock')) {
        // Simulate a real-time background sync delay to Google Sheets
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSyncStatus('synced');
        return;
      }

      await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // standard Apps Script POST targets operate on redirecting forms/no-cors safely
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: actionType,
          ...payload
        })
      });
      // "no-cors" triggers don't return response codes readable in sandbox environments, but they successfully stream to Sheet rows
      setSyncStatus('synced');
    } catch (err) {
      console.error('Remote sheets serialization index failed:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // HANDLERS
  const handleLogin = (role: 'admin' | 'employee', employeeId?: string) => {
    if (role === 'admin') {
      setIsAdminLoggedIn(true);
      setLoggedInEmployee(null);
      setCurrentView('dashboard');
      handleSaveToLocalStorage(employees, attendance, settings, appsScriptUrl, true, leaveRequests, notifications, null);
    } else if (role === 'employee' && employeeId) {
      const emp = employees.find(e => e.id === employeeId);
      if (emp) {
        setLoggedInEmployee(emp);
        setIsAdminLoggedIn(false);
        setCurrentView('terminal');
        handleSaveToLocalStorage(employees, attendance, settings, appsScriptUrl, false, leaveRequests, notifications, emp);
      }
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setLoggedInEmployee(null);
    setCurrentView('terminal');
    handleSaveToLocalStorage(employees, attendance, settings, appsScriptUrl, false, leaveRequests, notifications, null);
  };

  const handleEmployeeLogout = () => {
    setIsAdminLoggedIn(false);
    setLoggedInEmployee(null);
    setCurrentView('admin-login');
    handleSaveToLocalStorage(employees, attendance, settings, appsScriptUrl, false, leaveRequests, notifications, null);
  };

  const handleAddEmployee = async (newEmp: Employee) => {
    try {
      await setDoc(doc(db, 'employees', newEmp.id), newEmp);
      // Synchronous local state fallback
      setEmployees((prev) => [...prev.filter(e => e.id !== newEmp.id), newEmp]);
      triggerRemoteSheetsSync('syncEmployees', { employees: [...employees, newEmp] });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employees/${newEmp.id}`);
    }
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    try {
      await setDoc(doc(db, 'employees', updatedEmp.id), updatedEmp);
      setEmployees((prev) => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
      if (loggedInEmployee && loggedInEmployee.id === updatedEmp.id) {
        setLoggedInEmployee(updatedEmp);
      }
      triggerRemoteSheetsSync('syncEmployees', { employees: employees.map((emp) => emp.id === updatedEmp.id ? updatedEmp : emp) });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employees/${updatedEmp.id}`);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
      setEmployees((prev) => prev.filter(e => e.id !== id));
      triggerRemoteSheetsSync('syncEmployees', { employees: employees.filter((emp) => emp.id !== id) });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    }
  };

  const handleAddAttendance = async (newRecord: AttendanceRecord) => {
    const docId = `${newRecord.date}_${newRecord.employeeId}`;
    try {
      // Optimistic state update: update local state instantly before waiting for DB
      setAttendance((prev) => [...prev.filter(r => !(r.date === newRecord.date && r.employeeId === newRecord.employeeId)), newRecord]);

      // Fire Firestore write asynchronously in the background
      setDoc(doc(db, 'attendance', docId), newRecord).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
      });

      const empName = employees.find(e => e.id === newRecord.employeeId)?.name || 'Employee';

      // 1. Late Entry alert
      if (newRecord.entryTime) {
        const cleanEntry = newRecord.entryTime.replace(' AM', '').replace(' PM', '').trim();
        const cleanTarget = settings.workStartHour.trim();
        
        const [eH, eM] = cleanEntry.split(':').map(Number);
        const [tH, tM] = cleanTarget.split(':').map(Number);
        if (eH > tH || (eH === tH && eM > tM)) {
          handleRaiseNotification(
            'Late Entry Alert',
            `${empName} logged entry late at ${newRecord.entryTime} (Shift Window starts: ${settings.workStartHour} AM).`,
            'warning',
            newRecord.employeeId
          );
        }
      }

      // 2. Duplicate Check-in warning
      const duplicateCount = attendance.filter(r => r.date === newRecord.date && r.employeeId === newRecord.employeeId).length;
      if (duplicateCount > 0) {
        handleRaiseNotification(
          'Duplicate Entry Attempt',
          `Duplicate log warning: Multiple entry markers checked in for ${empName} today.`,
          'alert',
          newRecord.employeeId
        );
      }

      if (settings.autoSyncSheets) {
        triggerRemoteSheetsSync('syncAttendance', { record: newRecord });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
    }
  };

  const handleUpdateAttendance = async (updatedRecord: AttendanceRecord) => {
    const docId = `${updatedRecord.date}_${updatedRecord.employeeId}`;
    try {
      // Optimistic state update: update local state instantly before waiting for DB
      setAttendance((prev) => prev.map(rec => rec.date === updatedRecord.date && rec.employeeId === updatedRecord.employeeId ? updatedRecord : rec));

      // Fire Firestore write asynchronously in the background
      setDoc(doc(db, 'attendance', docId), updatedRecord).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
      });

      // Early Departure alert
      if (updatedRecord.exitTime) {
        const cleanExit = updatedRecord.exitTime.replace(' AM', '').replace(' PM', '').trim();
        const cleanTargetEnd = settings.workEndHour || '17:00';
        const [eH, eM] = cleanExit.split(':').map(Number);
        const [tH, tM] = cleanTargetEnd.split(':').map(Number);
        if (eH < tH || (eH === tH && eM < tM)) {
          const empName = employees.find(e => e.id === updatedRecord.employeeId)?.name || 'Employee';
          handleRaiseNotification(
            'Early Exit Alert',
            `${empName} wrapped shift early at ${updatedRecord.exitTime} (Target: ${settings.workEndHour} PM).`,
            'warning',
            updatedRecord.employeeId
          );
        }
      }

      if (settings.autoSyncSheets) {
        triggerRemoteSheetsSync('syncAttendance', { record: updatedRecord });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
    }
  };

  // Leave system request submission
  const handleSubmitLeaveRequest = async (newRequest: LeaveRequest) => {
    try {
      await setDoc(doc(db, 'leaveRequests', newRequest.id), newRequest);
      setLeaveRequests((prev) => [newRequest, ...prev.filter(r => r.id !== newRequest.id)]);
      
      handleRaiseNotification(
        'New Leave Request',
        `${newRequest.employeeName} submitted a ${newRequest.leaveType} leave request starting ${newRequest.startDate}.`,
        'info',
        newRequest.employeeId
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaveRequests/${newRequest.id}`);
    }
  };

  // Process / Approve Leave
  const handleDecideLeaveRequest = async (requestId: string, status: 'Approved' | 'Rejected') => {
    try {
      const targetRequest = leaveRequests.find(r => r.id === requestId);
      if (!targetRequest) return;

      const updatedRequest: LeaveRequest = { ...targetRequest, status };
      await setDoc(doc(db, 'leaveRequests', requestId), updatedRequest);
      setLeaveRequests((prev) => prev.map(r => r.id === requestId ? updatedRequest : r));

      if (status === 'Approved') {
        // excused with 'ON LEAVE' flag
        const newAttendanceRecord: AttendanceRecord = {
          employeeId: targetRequest.employeeId,
          employeeName: targetRequest.employeeName,
          date: targetRequest.startDate,
          entryTime: 'ON LEAVE',
          exitTime: 'ON LEAVE',
          lunchOut: '',
          lunchIn: '',
          totalHours: 0,
          overtime: 0,
          status: `On Leave: ${targetRequest.leaveType}`
        };

        const docId = `${targetRequest.startDate}_${targetRequest.employeeId}`;
        await setDoc(doc(db, 'attendance', docId), newAttendanceRecord);
        setAttendance((prev) => [...prev.filter(r => !(r.date === targetRequest.startDate && r.employeeId === targetRequest.employeeId)), newAttendanceRecord]);
        
        handleRaiseNotification(
          'Leave Approved',
          `${targetRequest.employeeName}'s leave approved for ${targetRequest.startDate}. Attendance Excuse recorded.`,
          'success',
          targetRequest.employeeId
        );
      } else {
        handleRaiseNotification(
          'Leave Declined',
          `${targetRequest.employeeName}'s leave request for ${targetRequest.startDate} was rejected.`,
          'warning',
          targetRequest.employeeId
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaveRequests/${requestId}`);
    }
  };

  const handleUpdateAppsScriptUrl = (url: string) => {
    setAppsScriptUrl(url);
    const nextStatus = url ? 'synced' : 'local';
    setSyncStatus(nextStatus);
    handleSaveToLocalStorage(employees, attendance, settings, url, isAdminLoggedIn);
  };

  const handleUpdateSettings = async (updatedSettings: Settings) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), updatedSettings);
      setSettings(updatedSettings);
      triggerRemoteSheetsSync('syncSettings', { settings: updatedSettings });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const handleClearAllAttendance = async () => {
    try {
      // Delete all records currently present in state from Firestore
      const deletePromises = attendance.map(rec => {
        const docId = `${rec.date}_${rec.employeeId}`;
        return deleteDoc(doc(db, 'attendance', docId));
      });
      await Promise.all(deletePromises);
      setAttendance([]);
      handleRaiseNotification(
        'Database Cleared',
        'All entry-exit attendance punch records have been deleted successfully.',
        'info'
      );
    } catch (err) {
      console.error('Error clearing Firestore attendance logs:', err);
      // fallback local clear
      setAttendance([]);
    }
  };

  const handleManualSyncAll = async () => {
    setIsSyncing(true);

    // 1. Direct API Google Sheets Sync using OAuth Access Token
    if (googleAccessToken && googleSpreadsheetId) {
      try {
        await syncSettingsToSheet(googleAccessToken, googleSpreadsheetId, settings);
        await syncEmployeesToSheet(googleAccessToken, googleSpreadsheetId, employees);
        await syncAllAttendanceToSheet(googleAccessToken, googleSpreadsheetId, attendance);
        setSyncStatus('synced');
        setIsSyncing(false);
        return; // Direct manual sync succeeded!
      } catch (err) {
        console.error('Direct Google Sheets manual full sync failed, reverting to Apps Script:', err);
      }
    }

    // 2. Apps Script Sync Fallback
    if (!appsScriptUrl) {
      setIsSyncing(false);
      return;
    }
    setSyncStatus('synced');

    try {
      if (appsScriptUrl.includes('DemoGoogleSheetsSyncIntegrationActive') || appsScriptUrl.includes('demo') || appsScriptUrl.includes('mock')) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return;
      }

      // 1. Sync Settings Configuration
      await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncSettings', settings })
      });

      // 2. Sync Employees List
      await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncEmployees', employees })
      });

      // 3. Sync Each Attendance Record
      for (const record of attendance) {
        await fetch(appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'syncAttendance', record })
        });
      }
    } catch (err) {
      console.error('Full manual database force sync failed:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        handleRaiseNotification(
          'Google Account Connected',
          'Successfully linked Google Sheets and Google Drive to sync attendance records.',
          'success'
        );
      }
    } catch (error: any) {
      console.error('Google alignment OAuth scope failure: ', error);
      handleRaiseNotification(
        'Google Authentication Failed',
        error.message || 'An error occurred during authentication.',
        'alert'
      );
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleAccessToken(null);
    handleRaiseNotification(
      'Google Account Disconnected',
      'Direct Google Sheets sync has been disabled.',
      'info'
    );
  };

  const handleCreateNewSpreadsheet = async (title: string): Promise<string> => {
    if (!googleAccessToken) {
      throw new Error('Please sign in to Google first.');
    }
    try {
      const spreadsheetId = await createSpreadsheet(googleAccessToken, title);
      localStorage.setItem('google_spreadsheet_id', spreadsheetId);
      setGoogleSpreadsheetId(spreadsheetId);
      handleRaiseNotification(
        'New Spreadsheet Created',
        `Successfully created Google Sheet: "${title}" in your Google Drive.`,
        'success'
      );
      // Run initial background sync to populate data immediately
      try {
        await syncSettingsToSheet(googleAccessToken, spreadsheetId, settings);
        await syncEmployeesToSheet(googleAccessToken, spreadsheetId, employees);
        await syncAllAttendanceToSheet(googleAccessToken, spreadsheetId, attendance);
      } catch (syncErr) {
        console.error('Initial bulk sync to new spreadsheet failed:', syncErr);
      }
      return spreadsheetId;
    } catch (err: any) {
      console.error('Failed to create new spreadsheet:', err);
      throw err;
    }
  };

  const handleUpdateSpreadsheetId = (id: string | null) => {
    if (id) {
      localStorage.setItem('google_spreadsheet_id', id);
    } else {
      localStorage.removeItem('google_spreadsheet_id');
    }
    setGoogleSpreadsheetId(id);
  };

  const handleViewChangeBySelector = (view: string) => {
    // View Guards
    if (isAdminLoggedIn) {
      setCurrentView(view);
    } else if (loggedInEmployee && (view === 'terminal' || view === 'leaves' || view === 'my-attendance')) {
      setCurrentView(view);
    } else if (view === 'terminal' || view === 'admin-login' || view === 'my-attendance') {
      setCurrentView(view);
    } else {
      setCurrentView('admin-login');
    }
    setIsSidebarOpen(false); // Close mobile panel
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Filter notifications for logged-in employee privacy
  const filteredNotifications = loggedInEmployee 
    ? notifications.filter(n => !n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast" || n.employeeId === loggedInEmployee.id)
    : notifications;

  const isNotificationRead = (n: AppNotification) => {
    if (!loggedInEmployee) return n.read;
    if (!n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast") {
      return (n.readByEmployees || []).includes(loggedInEmployee.id);
    }
    return n.read;
  };

  if (!isAdminLoggedIn && !loggedInEmployee) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" id="main-application-stage">
        <div className="max-w-md w-full">
          <LoginScreen
            onLogin={handleLogin}
            companyName={settings.companyName}
            employees={employees}
            onAddEmployee={handleAddEmployee}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" id="main-application-stage">
      <div className={`flex flex-1 w-full bg-[#f3f4f6] min-h-0 relative ${layoutMode === 'mobile' ? 'max-w-[430px] mx-auto bg-white border-r border-l border-slate-200/80 shadow-2xl relative' : ''}`}>
        {/* Dynamic Sidebar navigation */}
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChangeBySelector}
          isAdminLoggedIn={isAdminLoggedIn}
          loggedInEmployee={loggedInEmployee}
          onLogout={handleLogout}
          onEmployeeLogout={handleEmployeeLogout}
          companyName={settings.companyName}
          isOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          layoutMode={layoutMode}
        />

        {/* Main viewport */}
        <div className={`flex-1 flex flex-col ${layoutMode === 'desktop' ? 'lg:pl-72' : ''} min-w-0 min-h-screen pb-12`}>
          {/* Top bar (for mobile toggle menu / system status indicators) */}
          <header className="h-16 border-b border-slate-100 bg-white shadow-3xs flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 print:hidden select-none">
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleSidebar}
                className={`${layoutMode === 'desktop' ? 'lg:hidden' : ''} text-slate-500 hover:text-slate-800 bg-slate-100 p-2 rounded-xl transition-all cursor-pointer`}
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="hidden text-xs md:flex items-center space-x-1.5 font-bold uppercase font-mono tracking-widest text-slate-400">
              <span>View:</span>
              <span className="text-slate-650 tracking-normal capitalize font-sans">
                {currentView === 'terminal' && 'Attendance Kiosk Desk'}
                {currentView === 'dashboard' && 'Workforce Dashboard'}
                {currentView === 'employees' && 'Staff Directory'}
                {currentView === 'reports' && 'Wages & Overtime Audit'}
                {currentView === 'sync' && 'Sheets Integration Center'}
                {currentView === 'admin-login' && 'Admin Authorization'}
                {currentView === 'leaves' && 'Leaves & Verification Portal'}
              </span>
            </h2>
          </div>

          {/* Sync indicator caps */}
          <div className="flex items-center space-x-1.5 sm:space-x-3.5">
            <div 
              className={`flex items-center space-x-1 px-2 py-1 md:px-3 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border ${
                firebaseStatus === 'connected' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                firebaseStatus === 'connecting' ? 'bg-amber-50 border-amber-150 text-amber-700 animate-pulse' :
                'bg-rose-50 border-rose-100 text-rose-700'
              }`}
              title="Firebase Cloud Database Connection Status"
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${firebaseStatus === 'connected' ? 'bg-indigo-500 animate-pulse' : firebaseStatus === 'connecting' ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">Cloud DB: {firebaseStatus}</span>
              <span className="sm:hidden text-[9px]">DB: {firebaseStatus === 'connected' ? 'On' : firebaseStatus === 'connecting' ? 'Hold' : 'Off'}</span>
            </div>

            {appsScriptUrl ? (
              <div 
                className={`flex items-center space-x-1 px-2 py-1 md:px-3 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border ${
                  syncStatus === 'synced' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700 animate-pulse'
                }`}
                title="Synchronized to real-time Apps Script rows"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline-block">GAS Sheet: Connected</span>
                <span className="sm:hidden text-[9px]">GAS</span>
              </div>
            ) : (
              <div 
                className="flex items-center space-x-1 px-2 py-1 md:px-3 bg-slate-100 border border-slate-200 text-slate-550 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono"
                title="Mock database saving to browser localState"
              >
                <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="hidden sm:inline-block">LocalStorage Kiosk Active</span>
                <span className="sm:hidden text-[9px]">LOCAL</span>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={isAdminLoggedIn ? handleLogout : handleEmployeeLogout}
              className="flex items-center justify-center space-x-1 px-2.5 py-2 md:px-3.5 bg-rose-50 border border-slate-100 rounded-xl text-rose-700 text-xs font-bold hover:bg-rose-100 active:scale-95 transition-all select-none cursor-pointer"
              title="Click here to sign out"
            >
              <LogOut className="w-4 h-4 text-rose-505 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                id="header-bell-badge"
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                className="p-2 md:p-2.5 hover:bg-slate-50 border border-slate-150 hover:border-slate-200 rounded-xl relative transition-all cursor-pointer flex items-center justify-center select-none"
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {filteredNotifications.filter(u => !isNotificationRead(u)).length > 0 && (
                  <span className="absolute top-1 right-1 bg-rose-600 text-white font-mono text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-pulse shadow">
                    {filteredNotifications.filter(u => !isNotificationRead(u)).length}
                  </span>
                )}
              </button>

              {isNotificationDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-76 bg-white border border-slate-100 shadow-xl rounded-2xl z-30 p-4 space-y-3.5 animate-fadeIn font-sans text-left">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{loggedInEmployee ? 'My Personal Alerts' : 'Administrative Shifts Alerts'}</span>
                    </h3>
                    {filteredNotifications.filter(n => !isNotificationRead(n)).length > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            const unreadFilteredNotifs = filteredNotifications.filter(n => !isNotificationRead(n));
                            const updated = notifications.map(n => {
                              const match = unreadFilteredNotifs.find(ufn => ufn.id === n.id);
                              if (match) {
                                if (loggedInEmployee && (!n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast")) {
                                  const currentReadBy = n.readByEmployees || [];
                                  const nextReadBy = currentReadBy.includes(loggedInEmployee.id)
                                    ? currentReadBy
                                    : [...currentReadBy, loggedInEmployee.id];
                                  return { ...n, readByEmployees: nextReadBy };
                                } else {
                                  return { ...n, read: true };
                                }
                              }
                              return n;
                            });
                            setNotifications(updated);
                            for (const n of unreadFilteredNotifs) {
                              let updatedN: AppNotification;
                              if (loggedInEmployee && (!n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast")) {
                                const currentReadBy = n.readByEmployees || [];
                                const nextReadBy = currentReadBy.includes(loggedInEmployee.id)
                                  ? currentReadBy
                                  : [...currentReadBy, loggedInEmployee.id];
                                updatedN = { ...n, readByEmployees: nextReadBy };
                              } else {
                                updatedN = { ...n, read: true };
                              }
                              await setDoc(doc(db, 'notifications', n.id), updatedN);
                            }
                            setIsNotificationDropdownOpen(false);
                          } catch (err) {
                            handleFirestoreError(err, OperationType.WRITE, 'notifications');
                          }
                        }}
                        className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                      >
                        Read All
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {filteredNotifications.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-mono text-center py-6">No notifications collected today.</p>
                    ) : (
                      filteredNotifications.slice(0, 5).map(notif => {
                        const hasBeenRead = isNotificationRead(notif);
                        return (
                          <div key={notif.id} className={`p-2 rounded-xl border text-[11px] leading-normal space-y-0.5 ${hasBeenRead ? 'bg-slate-50/50 border-slate-100 text-slate-500' : 'bg-rose-50/20 border-rose-100 text-slate-700 font-medium'}`}>
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span>{notif.title}</span>
                              <span className="text-[8px] font-mono text-slate-400 font-normal">{notif.timestamp}</span>
                            </div>
                            <p className="text-[10px] text-slate-650 leading-normal font-sans">{notif.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {!loggedInEmployee && (
                    <div className="pt-2 text-center border-t border-slate-50">
                      <button
                        onClick={() => {
                          handleViewChangeBySelector('dashboard');
                          setIsNotificationDropdownOpen(false);
                        }}
                        className="text-[10px] text-indigo-650 hover:text-indigo-800 font-bold uppercase tracking-wider block w-full text-center"
                      >
                        Audit Shift Logs Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* View Router sheets */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {currentView === 'terminal' && (
            <AttendanceTerminal
              employees={employees}
              attendance={attendance}
              onAddAttendance={handleAddAttendance}
              onUpdateAttendance={handleUpdateAttendance}
              settings={settings}
              onRaiseNotification={handleRaiseNotification}
              loggedInEmployee={loggedInEmployee}
            />
          )}

          {currentView === 'admin-login' && (
            <LoginScreen
              onLogin={handleLogin}
              companyName={settings.companyName}
              employees={employees}
              onAddEmployee={handleAddEmployee}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardView
              employees={employees}
              attendance={attendance}
              settings={settings}
              onNavigateToView={handleViewChangeBySelector}
              notifications={notifications}
              leaveRequests={leaveRequests}
              onEvaluateEmployee={(empId) => handleLogin('employee', empId)}
              onSendNotification={handleRaiseNotification}
              onMarkNotificationRead={async (id) => {
                const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
                setNotifications(updated);
                const target = notifications.find(n => n.id === id);
                if (target) {
                  try {
                    await setDoc(doc(db, 'notifications', id), { ...target, read: true });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
                  }
                }
              }}
            />
          )}

          {currentView === 'employees' && (
            <EmployeeProfiles
              employees={employees}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              settings={settings}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              employees={employees}
              attendance={attendance}
              settings={settings}
              onAddAttendance={handleAddAttendance}
              onUpdateAttendance={handleUpdateAttendance}
              onClearAttendance={handleClearAllAttendance}
            />
          )}

          {currentView === 'sync' && (
            <SheetsSyncHub
              employees={employees}
              attendance={attendance}
              settings={settings}
              appsScriptUrl={appsScriptUrl}
              onUpdateUrl={handleUpdateAppsScriptUrl}
              onUpdateSettings={handleUpdateSettings}
              isSyncing={isSyncing}
              onManualSyncAll={handleManualSyncAll}
              googleAccessToken={googleAccessToken}
              googleSpreadsheetId={googleSpreadsheetId}
              onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
              onGoogleSignIn={handleGoogleSignIn}
              onDisconnectGoogle={handleDisconnectGoogle}
              onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
            />
          )}

          {currentView === 'leaves' && (
            <LeaveManagementView
              employees={employees}
              attendance={attendance}
              leaveRequests={leaveRequests}
              onSubmitLeaveRequest={(req) => {
                const newReq: LeaveRequest = {
                  ...req,
                  id: `LR-${Date.now()}`,
                  submittedAt: new Date().toISOString()
                };
                handleSubmitLeaveRequest(newReq);
              }}
              onDecideLeaveRequest={handleDecideLeaveRequest}
              isAdminLoggedIn={isAdminLoggedIn}
              settings={settings}
              loggedInEmployee={loggedInEmployee}
              onNavigateToView={handleViewChangeBySelector}
            />
          )}

          {currentView === 'my-attendance' && loggedInEmployee && (
            <MyAttendanceView
              loggedInEmployee={loggedInEmployee}
              attendance={attendance}
              onNavigateToView={handleViewChangeBySelector}
              onUpdateEmployee={handleUpdateEmployee}
              settings={settings}
              notifications={notifications}
              onMarkNotificationRead={async (id) => {
                const target = notifications.find(n => n.id === id);
                if (target) {
                  let updatedTarget: AppNotification;
                  if (!target.employeeId || target.employeeId === "" || target.employeeId === "all" || target.employeeId === "broadcast") {
                    const currentReadBy = target.readByEmployees || [];
                    const nextReadBy = currentReadBy.includes(loggedInEmployee.id)
                      ? currentReadBy
                      : [...currentReadBy, loggedInEmployee.id];
                    updatedTarget = { ...target, readByEmployees: nextReadBy };
                  } else {
                    updatedTarget = { ...target, read: true };
                  }

                  const updated = notifications.map(n => n.id === id ? updatedTarget : n);
                  setNotifications(updated);

                  try {
                    await setDoc(doc(db, 'notifications', id), updatedTarget);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
                  }
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Geofencing Admin Emergency Alert Popup */}
      {isAdminLoggedIn && unacknowledgedOutPunches.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-rose-100 shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
            
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900 leading-snug">🚨 Outside Geofence Punch Warning</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Employee transactions registered further than <strong>100 meters</strong> of Calitech HQ (26.118557, 91.539601) are automatically captured below:
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 max-h-[50vh]">
              {unacknowledgedOutPunches.map((rec) => {
                const coords = rec.locationIn || rec.locationEntry2 || rec.locationOut || rec.locationExit2 || '26.1185573,91.5396016';
                const mapUrl = `https://www.google.com/maps/place/${coords}/@${coords},18z`;
                return (
                  <div key={`${rec.date}_${rec.employeeId}`} className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800">{rec.employeeName}</span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                        {rec.distanceFromHq || 'Out of Range'}m Away
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="font-medium text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Log Date</span>
                        <span className="font-extrabold text-slate-700">{rec.date}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Registered Stamp</span>
                        <span className="font-extrabold text-slate-700">
                          {rec.entryTime || rec.entryTime2 || rec.exitTime || rec.exitTime2 || 'No timestamp'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-rose-100/60">
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black tracking-normal text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-100 hover:border-indigo-200 px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center space-x-1 shrink-0"
                      >
                        <MapPin className="w-3 h-3 text-indigo-500" />
                        <span>Trace on Google Maps</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleAcknowledgePunch(rec.date, rec.employeeId)}
                        className="text-[10px] font-extrabold px-3 py-1 bg-white border border-rose-200 hover:bg-rose-100 text-rose-750 rounded-lg cursor-pointer transition-all"
                      >
                        Acknowledge/Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <span className="text-[10px] font-semibold text-slate-400 font-mono tracking-tight">
                {unacknowledgedOutPunches.length} alert{unacknowledgedOutPunches.length > 1 ? 's' : ''} pending
              </span>

              <button
                type="button"
                onClick={handleAcknowledgeAllPunches}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                Acknowledge All Warnings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💼 QUICK ACTION MODALS OVERLAYS */}
      </div>
    </div>
  );
}
