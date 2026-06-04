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
  Smartphone,
  Trash
} from 'lucide-react';

import { Employee, AttendanceRecord, Settings, AppState, LeaveRequest, AppNotification, Expense } from './types';
import { INITIAL_EMPLOYEES, INITIAL_SETTINGS, generateInitialAttendance } from './data';
import { verifyProximityToOffice, OFFICE_COORDS, getLocalDateString, timeToMinutes, isValidTimeStr } from './utils/calculations';
import WorkLocationModal from './components/WorkLocationModal';

// Firebase imports
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, doc, setDoc as firestoreSetDoc, deleteDoc as firestoreDeleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, googleProvider, OperationType, handleFirestoreError, testConnection, cleanFirestoreData } from './firebase';

// Wrapped setDoc to ensure absolute safety against undefined fields in Firestore operations. Checks if Local-Only Mode is active.
const setDoc = (docRef: any, data: any, options?: any) => {
  try {
    const isLocal = localStorage.getItem('apex_local_only_mode') === 'true';
    if (isLocal) {
      console.log('Local-Only Mode active. Bypassing Firestore setDoc.');
      return Promise.resolve();
    }
  } catch (e) {
    console.error('LocalStorage check failed in global setDoc wrap:', e);
  }
  const cleaned = cleanFirestoreData(data);
  return options ? firestoreSetDoc(docRef, cleaned, options) : firestoreSetDoc(docRef, cleaned);
};

// Wrapped deleteDoc to allow bypassing when Local-Only Mode is active.
const deleteDoc = (docRef: any) => {
  try {
    const isLocal = localStorage.getItem('apex_local_only_mode') === 'true';
    if (isLocal) {
      console.log('Local-Only Mode active. Bypassing Firestore deleteDoc.');
      return Promise.resolve();
    }
  } catch (e) {
    console.error('LocalStorage check failed in global deleteDoc wrap:', e);
  }
  return firestoreDeleteDoc(docRef);
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
import MyExpensesView from './components/MyExpensesView';
import ExpenseManagementView from './components/ExpenseManagementView';
import CompanyRules from './components/CompanyRules';
import AttendanceRosterView from './components/AttendanceRosterView';

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
  const [layoutMode, setLayoutMode] = useState<'mobile' | 'desktop'>('desktop');
  
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
  const [isLocalOnlyMode, setIsLocalOnlyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_local_only_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'synced' | 'error'>('synced');
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Offline Punch Queue State
  const [punchQueue, setPunchQueue] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('offline_punch_queue');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse offline punch queue:', e);
      return [];
    }
  });
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);

  // Sync punch queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('offline_punch_queue', JSON.stringify(punchQueue));
  }, [punchQueue]);

  // Unified State Loader with real-time Firebase syncing
  useEffect(() => {
    // 1. Initial immediate boot load from LocalStorage as silent offline fallback
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Load cached offline values from LocalStorage cleanly
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
        if (parsed.expenses) setExpenses(parsed.expenses);
      } catch (e) {
        console.error('Failed reading serialized local storage files:', e);
      }
    }

    if (isLocalOnlyMode) {
      setFirebaseStatus('offline');
      setFirebaseError(null);
      console.log('LocalStorage Kiosk Active (Zero-Cost Local-Only Mode initiated by user preferences)');
      return;
    }

    // 2. Perform Anonymous Firebase auth login mapping or fallback to unauthenticated
    setFirebaseStatus('connecting');
    setFirebaseError(null);

    let unsubEmp: (() => void) | null = null;
    let unsubAttendance: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;
    let unsubLeaves: (() => void) | null = null;
    let unsubNotifs: (() => void) | null = null;
    let unsubExpenses: (() => void) | null = null;
    let destroyed = false;

    // Fast failover error proxy to catch Quota Exceeded and seamlessly auto-transition to local mode without breaking active kiosk.
    const handleSubscriptionError = (err: any, label: string) => {
      console.error(`${label} snapshot subscription query failed:`, err);
      const errMsg = err?.message || String(err);
      
      const isQuotaExceeded = errMsg.toLowerCase().includes('quota') || 
                              errMsg.toLowerCase().includes('limit exceeded') || 
                              errMsg.toLowerCase().includes('resource exhausted') ||
                              errMsg.toLowerCase().includes('denied');
                              
      if (isQuotaExceeded) {
        console.warn('GCP Firestore Free Tier daily limits exceeded! Automatically transitioning database to Local-Only mode to avoid user disruption.');
        localStorage.setItem('apex_local_only_mode', 'true');
        setIsLocalOnlyMode(true);
        setFirebaseStatus('offline');
        setFirebaseError(null);
      } else {
        setFirebaseStatus('error');
        setFirebaseError(errMsg);
      }
    };

    const setupSubscriptions = () => {
      if (destroyed) return;

      // Snapshot - Settings
      // Since settings/global is the master initialization document,
      // its creation/existence dictates if we seed initial defaults to an empty Firestore instance.
      unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        if (!docSnap.exists()) {
          console.log('Pristine database detected. Seeding settings and demo fixtures to Firestore...');
          
          // Seed settings
          setDoc(doc(db, 'settings', 'global'), INITIAL_SETTINGS).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'settings/global');
          });

          // Seed default employees
          INITIAL_EMPLOYEES.forEach((emp) => {
            setDoc(doc(db, 'employees', emp.id), emp).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `employees/${emp.id}`);
            });
          });

          // Seed default attendance
          const seededLogs = generateInitialAttendance(new Date().toISOString().split('T')[0]);
          seededLogs.forEach((rec) => {
            const docId = `${rec.date}_${rec.employeeId}`;
            setDoc(doc(db, 'attendance', docId), rec).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
            });
          });

          // Seed default leaves
          INITIAL_LEAVE_REQUESTS.forEach((req) => {
            setDoc(doc(db, 'leaveRequests', req.id), req).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `leaveRequests/${req.id}`);
            });
          });

          // Seed default notifications
          INITIAL_NOTIFICATIONS.forEach((notif) => {
            setDoc(doc(db, 'notifications', notif.id), notif).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`);
            });
          });
        } else {
          setSettings(docSnap.data() as Settings);
        }
      }, (err) => {
        handleSubscriptionError(err, 'Settings');
      });

      // Snapshot - Employees
      unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        const list: Employee[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Employee);
        });
        setEmployees(list);
      }, (err) => {
        handleSubscriptionError(err, 'Employees');
      });

      // Snapshot - Attendance
      unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        const list: AttendanceRecord[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as AttendanceRecord);
        });
        setAttendance(list);
      }, (err) => {
        handleSubscriptionError(err, 'Attendance');
      });

      // Snapshot - Leave Requests
      unsubLeaves = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as LeaveRequest);
        });
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setLeaveRequests(list);
      }, (err) => {
        handleSubscriptionError(err, 'Leave requests');
      });

      // Snapshot - Notifications
      unsubNotifs = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        const list: AppNotification[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as AppNotification);
        });
        // Sort by unique timestamp string or id if desired, keeping newest first
        list.sort((a, b) => b.id.localeCompare(a.id));
        setNotifications(list);
      }, (err) => {
        handleSubscriptionError(err, 'Audit alerts');
      });

      // Snapshot - Expenses
      unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
        setFirebaseStatus('connected');
        setFirebaseError(null);
        const list: Expense[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Expense);
        });
        // Sort by submittedAt descending
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setExpenses(list);
      }, (err) => {
        handleSubscriptionError(err, 'Expenses');
      });
    };

    signInAnonymously(auth)
      .then(async () => {
        console.log('Firebase Anonymous Session initialized successfully.');
        const isOnline = await testConnection();
        // If snapshot succeeds it will configure connected anyway, but we set initial state
        setFirebaseStatus(isOnline ? 'connected' : 'offline');
        if (!isOnline) {
          setFirebaseError('Database handshake timed out or is unverified.');
        }
        setupSubscriptions();
      })
      .catch(async (err) => {
        console.warn('Firebase Anonymous Auth restricted by GCP project policy, proceeding unauthenticated:', err.message);
        const isOnline = await testConnection();
        setFirebaseStatus(isOnline ? 'connected' : 'offline');
        if (!isOnline) {
          setFirebaseError('Unauthenticated. Handshake timed out or is unverified.');
        }
        setupSubscriptions();
      });

    return () => {
      destroyed = true;
      if (unsubEmp) unsubEmp();
      if (unsubAttendance) unsubAttendance();
      if (unsubSettings) unsubSettings();
      if (unsubLeaves) unsubLeaves();
      if (unsubNotifs) unsubNotifs();
      if (unsubExpenses) unsubExpenses();
    };
  }, [isLocalOnlyMode]);

  // Unified State Writer to LocalStorage
  const handleSaveToLocalStorage = (
    nextEmployees: Employee[] = employees,
    nextAttendance: AttendanceRecord[] = attendance,
    nextSettings: Settings = settings,
    nextUrl: string = appsScriptUrl,
    nextAdminState: boolean = isAdminLoggedIn,
    nextLeaves: LeaveRequest[] = leaveRequests,
    nextNotifs: AppNotification[] = notifications,
    nextEmp: Employee | null = loggedInEmployee,
    nextExpenses: Expense[] = expenses
  ) => {
    const backupObj = {
      employees: nextEmployees,
      attendance: nextAttendance,
      settings: nextSettings,
      appsScriptUrl: nextUrl,
      isAdminLoggedIn: nextAdminState,
      leaveRequests: nextLeaves,
      notifications: nextNotifs,
      loggedInEmployee: nextEmp,
      expenses: nextExpenses
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backupObj));
  };

  // Sync to localCache as reactive backup automatically on React states variations
  useEffect(() => {
    handleSaveToLocalStorage();
  }, [employees, attendance, settings, appsScriptUrl, isAdminLoggedIn, leaveRequests, notifications, loggedInEmployee, expenses]);

  // Dynamic Self-Healing for Employee ID Changes
  // If the admin changes an employee's ID, any active/cached session on the employee's device
  // might still be using the old ID. This sync effect detects that mismatch, automatically resolves
  // the email against the live employees roster, heals the active session, and migrates any
  // orphaned attendance records (punched today or historically) to the new ID.
  useEffect(() => {
    if (loggedInEmployee && employees.length > 0) {
      // Find the corresponding profile match in the live database roster by unique email
      const freshProfile = employees.find(
        (emp) => emp.email && loggedInEmployee.email && emp.email.toLowerCase() === loggedInEmployee.email.toLowerCase()
      );

      if (freshProfile && freshProfile.id !== loggedInEmployee.id) {
        const oldId = loggedInEmployee.id;
        const newId = freshProfile.id;
        console.log(`Self-Healing Activated: Migrating session for ${freshProfile.name} from stale ID "${oldId}" to active ID "${newId}"`);

        // 1. Safe update of the logged-in session state
        setLoggedInEmployee(freshProfile);

        // 2. Identify and safely migrate any attendance records created with the stale ID
        const affectedAttendance = attendance.filter((rec) => rec.employeeId === oldId);
        if (affectedAttendance.length > 0) {
          console.log(`Self-Healing: Migrating ${affectedAttendance.length} attendance records to correct ID "${newId}"`);

          // Optimistically update local attendance state
          setAttendance((prev) =>
            prev.map((rec) =>
              rec.employeeId === oldId
                ? { ...rec, employeeId: newId, employeeName: freshProfile.name }
                : rec
            )
          );

          // Delete stale documents and recreate with correct active ID in Firestore
          affectedAttendance.forEach((rec) => {
            const oldDocId = `${rec.date}_${oldId}`;
            const newDocId = `${rec.date}_${newId}`;
            const updatedRecord = {
              ...rec,
              employeeId: newId,
              employeeName: freshProfile.name,
            };

            deleteDoc(doc(db, 'attendance', oldDocId)).catch((err) =>
              console.warn(`Self-heal delete of doc "${oldDocId}" failed:`, err)
            );
            setDoc(doc(db, 'attendance', newDocId), updatedRecord).catch((err) =>
              console.warn(`Self-heal write of doc "${newDocId}" failed:`, err)
            );
          });
        }
      }
    }
  }, [employees, loggedInEmployee, attendance]);

  // Automatic Real-time Google Sheets Mirroring on dynamic snapshot updates
  useEffect(() => {
    if (!googleAccessToken || !googleSpreadsheetId || !settings.autoSyncSheets) {
      return;
    }

    // Debounce timer (3 seconds) to prevent API rate-limits during bulk/fast updates
    const timer = setTimeout(async () => {
      try {
        console.log('Real-time sync: Mirroring Employees roster to connected Google Sheet...');
        await syncEmployeesToSheet(googleAccessToken, googleSpreadsheetId, employees);
      } catch (err) {
        console.error('Real-time automatic Employees sheets mirror sync failed:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [employees, googleAccessToken, googleSpreadsheetId, settings.autoSyncSheets]);

  useEffect(() => {
    if (!googleAccessToken || !googleSpreadsheetId || !settings.autoSyncSheets) {
      return;
    }

    // Debounce timer (3.5 seconds) to prevent concurrent write rate-limits on Sheets API
    const timer = setTimeout(async () => {
      try {
        console.log('Real-time sync: Mirroring Attendance logs to connected Google Sheet...');
        await syncAllAttendanceToSheet(googleAccessToken, googleSpreadsheetId, attendance);
      } catch (err) {
        console.error('Real-time automatic Attendance sheets mirror sync failed:', err);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [attendance, googleAccessToken, googleSpreadsheetId, settings.autoSyncSheets]);

  // Trigger queue sync when connectivity is restored or when forced
  const syncOfflineQueue = async () => {
    if (punchQueue.length === 0 || isSyncingQueue) return;
    setIsSyncingQueue(true);
    console.log(`Starting synchronization of ${punchQueue.length} offline queued punches...`);
    
    const successfullySynced: string[] = [];
    
    for (const record of punchQueue) {
      const docId = `${record.date}_${record.employeeId}`;
      try {
        // 1. Sync to Firebase Cloud
        await setDoc(doc(db, 'attendance', docId), record);
        
        // 2. Sync to Google Sheets if settings.autoSyncSheets is true
        if (settings.autoSyncSheets && googleAccessToken && googleSpreadsheetId) {
          try {
            await syncAttendanceRecordToSheet(googleAccessToken, googleSpreadsheetId, record);
          } catch (err) {
            console.error(`Google Sheets sync failed for offline punch of ${record.employeeName}:`, err);
          }
        }
        
        successfullySynced.push(docId);
        
        // Raise success alert
        handleRaiseNotification(
          'Offline Punch Synced',
          `Successfully uploaded offline punch record for ${record.employeeName || 'Staff'} (${record.date}) to Cloud database.`,
          'success',
          record.employeeId
        );
      } catch (err) {
        console.error(`Failed to sync offline record for ${record.employeeName} (${docId}):`, err);
        // Break out of loop if Firestore sync is still failing due to connection
        break;
      }
    }

    if (successfullySynced.length > 0) {
      setPunchQueue(prev => prev.filter(rec => !successfullySynced.includes(`${rec.date}_${rec.employeeId}`)));
    }
    setIsSyncingQueue(false);
  };

  const handleManualConnectionCheck = async () => {
    if (firebaseStatus === 'connecting') return;
    setFirebaseStatus('connecting');
    setFirebaseError(null);
    console.log('Manually checking Cloud DB connection...');
    const isOnline = await testConnection();
    if (isOnline) {
      setFirebaseStatus('connected');
      handleRaiseNotification(
        'Database Sync Restored',
        'Successfully established handshake with live Google Cloud Firestore. Refreshing feeds...',
        'success'
      );
      if (punchQueue.length > 0) {
        await syncOfflineQueue();
      }
    } else {
      setFirebaseStatus('offline');
      setFirebaseError('Handshake timed out or unverified.');
      handleRaiseNotification(
        'Database Sync Failed',
        'Could not reach database server. Operating in robust offline-cache mode.',
        'warning'
      );
    }
  };

  // Run automatically when firebaseStatus becomes 'connected'
  useEffect(() => {
    if (firebaseStatus === 'connected' && punchQueue.length > 0 && !isSyncingQueue) {
      syncOfflineQueue();
    }
  }, [firebaseStatus, punchQueue, isSyncingQueue]);

  // Listen for browser online/offline events to dynamically adjust status and trigger sync
  useEffect(() => {
    const handleOnline = async () => {
      console.log('Browser online event received. Testing Firebase connection...');
      const isOnline = await testConnection();
      if (isOnline) {
        setFirebaseStatus('connected');
      } else {
        setFirebaseStatus('offline');
      }
    };

    const handleOffline = () => {
      console.log('Browser offline event received.');
      setFirebaseStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic ping to check connection every 35 seconds to ensure real-time accuracy without overriding active listener
    const interval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setFirebaseStatus('offline');
        return;
      }
      const isOnline = await testConnection();
      if (isOnline) {
        setFirebaseStatus(prev => prev === 'offline' ? 'connected' : prev);
      }
    }, 35000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

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

  const triggerAutoLogout = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.loggedInEmployee = null;
        parsed.isAdminLoggedIn = false;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch (e) {
      console.error('Failed to clear session in localStorage during auto-logout:', e);
    }
    setIsAdminLoggedIn(false);
    setLoggedInEmployee(null);
    setCurrentView('admin-login');
    window.location.reload();
  };

  // Automated 5-minute inactivity check and background/minimized app switching detection
  useEffect(() => {
    if (!loggedInEmployee) return;

    let lastActive = Date.now();
    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

    const handleUserActivity = () => {
      lastActive = Date.now();
    };

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const timeSinceLastActive = Date.now() - lastActive;
      if (timeSinceLastActive >= INACTIVITY_LIMIT) {
        clearInterval(checkInterval);
        triggerAutoLogout();
      }
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerAutoLogout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loggedInEmployee]);

  const handleAddEmployee = async (newEmp: Employee) => {
    try {
      // 1. Optimistic state update: update local state instantly
      setEmployees((prev) => [...prev.filter(e => e.id !== newEmp.id), newEmp]);

      // 2. Perform Firestore write in background without blocking
      setDoc(doc(db, 'employees', newEmp.id), newEmp).catch((err) => {
        console.warn('Background Firestore write failed for new employee:', err);
        handleRaiseNotification(
          'Sync Warning',
          `Could not sync employee profile for ${newEmp.name} to cloud instantly. Storing locally.`,
          'warning'
        );
      });

      // 3. Initiate Sheets integration async
      triggerRemoteSheetsSync('syncEmployees', { employees: [...employees, newEmp] });
    } catch (err) {
      console.error('Failure in handleAddEmployee:', err);
    }
  };

  const handleUpdateEmployee = async (updatedEmp: Employee, originalId?: string) => {
    try {
      const actualOldId = originalId || updatedEmp.id;

      // 1. Optimistic state updates
      setEmployees((prev) => prev.map(e => e.id === actualOldId ? updatedEmp : e));
      if (loggedInEmployee && loggedInEmployee.id === actualOldId) {
        setLoggedInEmployee(updatedEmp);
      }

      // If ID changed: clean up old Firestore documents and migrate attendance logs
      if (originalId && originalId !== updatedEmp.id) {
        const affectedAttendance = attendance.filter(att => att.employeeId === originalId);
        
        // Update local attendance state
        setAttendance((prev) => 
          prev.map(att => att.employeeId === originalId ? { ...att, employeeId: updatedEmp.id } : att)
        );

        // Delete old docs and recreate with new ID in Firestore
        affectedAttendance.forEach((rec) => {
          const oldDocId = `${rec.date}_${originalId}`;
          const newDocId = `${rec.date}_${updatedEmp.id}`;
          const updatedRecord = { ...rec, employeeId: updatedEmp.id };
          
          deleteDoc(doc(db, 'attendance', oldDocId)).catch(err => console.warn(err));
          setDoc(doc(db, 'attendance', newDocId), updatedRecord).catch(err => console.warn(err));
        });

        // Delete old employee record
        deleteDoc(doc(db, 'employees', originalId)).catch((err) => {
          console.warn('Background Firestore old employee delete failed:', err);
        });
      }

      // 2. Background Firestore write
      setDoc(doc(db, 'employees', updatedEmp.id), updatedEmp).catch((err) => {
        console.warn('Background Firestore update failed for employee:', err);
      });

      // 3. Trigger Sheets sync async
      const localUpdatedEmployees = employees.map(emp => emp.id === actualOldId ? updatedEmp : emp);
      triggerRemoteSheetsSync('syncEmployees', { employees: localUpdatedEmployees });
    } catch (err) {
      console.error('Failure in handleUpdateEmployee:', err);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      // 1. Optimistic state filter
      setEmployees((prev) => prev.filter(e => e.id !== id));

      // 2. Background Firestore delete
      deleteDoc(doc(db, 'employees', id)).catch((err) => {
        console.warn('Background Firestore deletion failed for employee:', err);
      });

      // 3. Trigger Sheets sync
      triggerRemoteSheetsSync('syncEmployees', { employees: employees.filter((emp) => emp.id !== id) });
    } catch (err) {
      console.error('Failure in handleDeleteEmployee:', err);
    }
  };

  const handleClearAllEmployees = async () => {
    try {
      const deletePromises = employees.map(emp => {
        return deleteDoc(doc(db, 'employees', emp.id));
      });
      await Promise.all(deletePromises);
      setEmployees([]);
      handleRaiseNotification(
        'Workforce Reset',
        'All employee profiles have been deleted and cleared as requested.',
        'info'
      );
    } catch (err) {
      console.error('Error clearing employees:', err);
      setEmployees([]);
    }
  };

  const detectShiftOverlap = (
    record: AttendanceRecord,
    currentAttendance: AttendanceRecord[],
    originalEmployeeId?: string,
    originalDate?: string
  ): { hasOverlap: boolean; reason: string } | null => {
    const oldEmpId = originalEmployeeId || record.employeeId;
    const oldDate = originalDate || record.date;

    // Filter out the specific record being edited from the existing list
    const empRecords = currentAttendance.filter(r => 
      r.employeeId === record.employeeId && 
      !(r.date === oldDate && r.employeeId === oldEmpId) &&
      r.date !== record.date
    );

    // Combine with the new/updated state
    const relevantRecords = [...empRecords, record];

    const shifts: Array<{
      date: string;
      start: number;
      end: number;
      isPending: boolean;
      label: string;
    }> = [];

    const getAbsMinutes = (dateStr: string, timeStr: string): number => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const baseMin = Math.floor(new Date(y, m - 1, d).getTime() / 60000);
      return baseMin + timeToMinutes(timeStr);
    };

    relevantRecords.forEach(r => {
      // Shift 1
      if (isValidTimeStr(r.entryTime)) {
        const start1 = getAbsMinutes(r.date, r.entryTime);
        const hasExit = isValidTimeStr(r.exitTime);
        const end1 = hasExit ? getAbsMinutes(r.date, r.exitTime) : start1 + 480;
        shifts.push({
          date: r.date,
          start: start1,
          end: end1,
          isPending: !hasExit,
          label: `Shift 1 on ${r.date} (${r.entryTime}${hasExit ? ' - ' + r.exitTime : ' [Ongoing]'})`
        });
      }

      // Shift 2
      if (isValidTimeStr(r.entryTime2)) {
        const start2 = getAbsMinutes(r.date, r.entryTime2);
        const hasExit2 = isValidTimeStr(r.exitTime2);
        const end2 = hasExit2 ? getAbsMinutes(r.date, r.exitTime2) : start2 + 480;
        shifts.push({
          date: r.date,
          start: start2,
          end: end2,
          isPending: !hasExit2,
          label: `Shift 2 on ${r.date} (${r.entryTime2}${hasExit2 ? ' - ' + r.exitTime2 : ' [Ongoing]'})`
        });
      }
    });

    shifts.sort((a, b) => a.start - b.start);

    for (let i = 0; i < shifts.length - 1; i++) {
      const s1 = shifts[i];
      const s2 = shifts[i + 1];
      const s1End = s1.isPending ? s1.start + 1440 : s1.end;

      if (s2.start < s1End) {
        return {
          hasOverlap: true,
          reason: `Attempted punch at ${s2.label.split(' on ')[0]} overlaps with preceding active "${s1.label}" which has not ended or is still ongoing.`
        };
      }
    }

    return null;
  };

  const handleAddAttendance = async (newRecord: AttendanceRecord) => {
    const docId = `${newRecord.date}_${newRecord.employeeId}`;

    // Prevent shift overlaps that would corrupt payroll calculations
    const overlapCheck = detectShiftOverlap(newRecord, attendance);
    if (overlapCheck) {
      alert(`Shift Overlap Blocked!\n\n${overlapCheck.reason}`);
      handleRaiseNotification(
        'Shift Overlap Blocked',
        overlapCheck.reason,
        'alert',
        newRecord.employeeId
      );
      return;
    }

    try {
      // Optimistic state update: update local state instantly before waiting for DB
      setAttendance((prev) => [...prev.filter(r => !(r.date === newRecord.date && r.employeeId === newRecord.employeeId)), newRecord]);

      // Determine connection state
      const isOfflineMode = firebaseStatus === 'offline' || firebaseStatus === 'error' || !navigator.onLine;

      if (isOfflineMode) {
        setPunchQueue(prev => {
          const filtered = prev.filter(r => !(r.date === newRecord.date && r.employeeId === newRecord.employeeId));
          return [...filtered, newRecord];
        });

        handleRaiseNotification(
          'Offline Punch Queued',
          `Working offline. Stamp registered locally for ${newRecord.employeeName || 'Staff'} & queued for sync.`,
          'info',
          newRecord.employeeId
        );
      } else {
        // Fire Firestore write asynchronously in the background
        setDoc(doc(db, 'attendance', docId), newRecord).catch(err => {
          console.warn('Firestore direct upload failed, adding punch to offline queue:', err);
          setPunchQueue(prev => {
            const filtered = prev.filter(r => !(r.date === newRecord.date && r.employeeId === newRecord.employeeId));
            return [...filtered, newRecord];
          });
        });
      }

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

      if (settings.autoSyncSheets && !isOfflineMode) {
        triggerRemoteSheetsSync('syncAttendance', { record: newRecord });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
    }
  };

  const handleUpdateAttendance = async (updatedRecord: AttendanceRecord, originalEmployeeId?: string, originalDate?: string) => {
    const oldEmpId = originalEmployeeId || updatedRecord.employeeId;
    const oldDate = originalDate || updatedRecord.date;
    const isKeyChanged = oldEmpId !== updatedRecord.employeeId || oldDate !== updatedRecord.date;

    const docId = `${updatedRecord.date}_${updatedRecord.employeeId}`;
    const oldDocId = `${oldDate}_${oldEmpId}`;

    // Prevent shift overlaps that would corrupt payroll calculations on updates
    const overlapCheck = detectShiftOverlap(updatedRecord, attendance, oldEmpId, oldDate);
    if (overlapCheck) {
      alert(`Shift Overlap Blocked!\n\n${overlapCheck.reason}`);
      handleRaiseNotification(
        'Shift Overlap Blocked',
        overlapCheck.reason,
        'alert',
        updatedRecord.employeeId
      );
      return;
    }

    try {
      // Optimistic state update: update local state instantly before waiting for DB
      setAttendance((prev) => {
        let list = prev;
        if (isKeyChanged) {
          // Filter out the old record to prevent duplicates
          list = list.filter(rec => !(rec.date === oldDate && rec.employeeId === oldEmpId));
        }
        return [...list.filter(rec => !(rec.date === updatedRecord.date && rec.employeeId === updatedRecord.employeeId)), updatedRecord];
      });

      // Determine connection state
      const isOfflineMode = firebaseStatus === 'offline' || firebaseStatus === 'error' || !navigator.onLine;

      if (isOfflineMode) {
        setPunchQueue(prev => {
          let list = prev;
          if (isKeyChanged) {
            list = list.filter(r => !(r.date === oldDate && r.employeeId === oldEmpId));
          }
          const filtered = list.filter(r => !(r.date === updatedRecord.date && r.employeeId === updatedRecord.employeeId));
          return [...filtered, updatedRecord];
        });

        handleRaiseNotification(
          'Offline Punch Queued',
          `Working offline. Stamp updated locally for ${updatedRecord.employeeName || 'Staff'} & queued for sync.`,
          'info',
          updatedRecord.employeeId
        );
      } else {
        if (isKeyChanged) {
          // Delete old record from Firestore to avoid leaving orphans
          deleteDoc(doc(db, 'attendance', oldDocId)).catch(err => console.warn('Failed to delete old record during key change:', err));
        }

        // Fire Firestore write asynchronously in the background
        setDoc(doc(db, 'attendance', docId), updatedRecord).catch(err => {
          console.warn('Firestore direct write failed, adding updated punch to offline queue:', err);
          setPunchQueue(prev => {
            const filtered = prev.filter(r => !(r.date === updatedRecord.date && r.employeeId === updatedRecord.employeeId));
            return [...filtered, updatedRecord];
          });
        });
      }

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

      if (settings.autoSyncSheets && !isOfflineMode) {
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

  const handleDeleteNotification = async (id: string) => {
    try {
      const target = notifications.find(n => n.id === id);
      if (!target) return;

      if (loggedInEmployee && (!target.employeeId || target.employeeId === "" || target.employeeId === "all" || target.employeeId === "broadcast")) {
        // Broadcast notification: append current user ID to deleted list to hide it for them
        const currentDeletedBy = target.deletedByEmployees || [];
        const nextDeletedBy = currentDeletedBy.includes(loggedInEmployee.id)
          ? currentDeletedBy
          : [...currentDeletedBy, loggedInEmployee.id];
        const updatedTarget = { ...target, deletedByEmployees: nextDeletedBy };
        
        const updated = notifications.map(n => n.id === id ? updatedTarget : n);
        setNotifications(updated);
        await setDoc(doc(db, 'notifications', id), updatedTarget);
      } else {
        // Direct private notification: delete fully from Firestore
        const updated = notifications.filter(n => n.id !== id);
        setNotifications(updated);
        await deleteDoc(doc(db, 'notifications', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      if (loggedInEmployee) {
        // Delete or hide all notifications currently matching filteredNotifications
        const deletePromises = filteredNotifications.map(async (target) => {
          if (!target.employeeId || target.employeeId === "" || target.employeeId === "all" || target.employeeId === "broadcast") {
            const currentDeletedBy = target.deletedByEmployees || [];
            const nextDeletedBy = currentDeletedBy.includes(loggedInEmployee.id)
              ? currentDeletedBy
              : [...currentDeletedBy, loggedInEmployee.id];
            const updatedTarget = { ...target, deletedByEmployees: nextDeletedBy };
            return setDoc(doc(db, 'notifications', target.id), updatedTarget);
          } else {
            return deleteDoc(doc(db, 'notifications', target.id));
          }
        });
        await Promise.all(deletePromises);

        // Update local React state filter matches
        const updated = notifications.map(n => {
          const isF = filteredNotifications.some(fn => fn.id === n.id);
          if (isF) {
            if (!n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast") {
              const currentDeletedBy = n.deletedByEmployees || [];
              const nextDeletedBy = currentDeletedBy.includes(loggedInEmployee.id)
                ? currentDeletedBy
                : [...currentDeletedBy, loggedInEmployee.id];
              return { ...n, deletedByEmployees: nextDeletedBy };
            }
          }
          return n;
        }).filter(n => {
          if (n.employeeId === loggedInEmployee.id) {
            const isF = filteredNotifications.some(fn => fn.id === n.id);
            return !isF;
          }
          return true;
        });
        setNotifications(updated);
      } else {
        // Admin context: Clear all notifications in view
        const deletePromises = filteredNotifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
        await Promise.all(deletePromises);
        setNotifications([]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications/clear-all');
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
          'success',
          'admin'
        );
      }
    } catch (error: any) {
      console.error('Google alignment OAuth scope failure: ', error);
      handleRaiseNotification(
        'Google Authentication Failed',
        error.message || 'An error occurred during authentication.',
        'alert',
        'admin'
      );
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleAccessToken(null);
    handleRaiseNotification(
      'Google Account Disconnected',
      'Direct Google Sheets sync has been disabled.',
      'info',
      'admin'
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
        'success',
        'admin'
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
    } else if (loggedInEmployee && (view === 'terminal' || view === 'leaves' || view === 'my-attendance' || view === 'rules' || view === 'my-expenses')) {
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
    ? notifications.filter(n => {
        const isTargeted = !n.employeeId || n.employeeId === "" || n.employeeId === "all" || n.employeeId === "broadcast" || n.employeeId === loggedInEmployee.id;
        if (!isTargeted) return false;
        if (n.deletedByEmployees && n.deletedByEmployees.includes(loggedInEmployee.id)) {
          return false;
        }
        return true;
      })
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
            onUpdateEmployee={handleUpdateEmployee}
            settings={settings}
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
                {currentView === 'roster' && 'Audit Desk'}
                {currentView === 'reports' && 'Wages & Overtime Audit'}
                {currentView === 'rules' && 'Rules & Guidelines Directory'}
                {currentView === 'sync' && 'Sheets Integration Center'}
                {currentView === 'admin-login' && 'Admin Authorization'}
                {currentView === 'leaves' && 'Leaves & Verification Portal'}
                {currentView === 'my-expenses' && 'My Expense Claim Ledger'}
                {currentView === 'expenses-admin' && 'Global Expense Management Board'}
              </span>
            </h2>
          </div>

          {/* Sync indicator caps */}
          <div className="flex items-center space-x-1.5 sm:space-x-3.5">
            {punchQueue.length > 0 && (
              <div 
                onClick={firebaseStatus === 'connected' ? syncOfflineQueue : undefined}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border select-none transition-all cursor-pointer ${
                  firebaseStatus === 'connected' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-850 hover:bg-emerald-100/90 hover:border-emerald-300' 
                    : 'bg-amber-50 border-amber-200 text-amber-850 hover:bg-amber-100/90 animate-pulse'
                }`}
                title={firebaseStatus === 'connected' ? "Connection restored! Click here to flush and sync queued punches immediately." : `${punchQueue.length} offline punches are locally saved. They will automatically sync when connection is recovered.`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${firebaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>Queue: {punchQueue.length} offline</span>
              </div>
            )}

            {/* Toggleable Mode (Cloud vs Local Zero-Quota) */}
            <button 
              onClick={() => {
                const nextMode = !isLocalOnlyMode;
                if (nextMode) {
                  if (confirm("Switch to 100% Free Local Mode? This will stop querying your Firestore database to conserve your daily free read/write limits. The app will persist all records locally completely for free.")) {
                    localStorage.setItem('apex_local_only_mode', 'true');
                    setIsLocalOnlyMode(true);
                  }
                } else {
                  if (confirm("Restore Firebase Cloud Sync Mode? The app will resume listening and syncing with Firestore. (Requires free daily quota elements or billing).")) {
                    localStorage.removeItem('apex_local_only_mode');
                    setIsLocalOnlyMode(false);
                  }
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider font-mono border cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-xs ${
                isLocalOnlyMode 
                  ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-150' 
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/95'
              }`}
              title={isLocalOnlyMode ? "Operating in Zero-Quota Local Storage. Click to reactivate Cloud Firebase sync." : "Operating in Cloud Sync. Click to activate Zero-Quota Local Mode and save your free tier!"}
            >
              <Zap className={`w-3.5 h-3.5 shrink-0 ${isLocalOnlyMode ? 'text-amber-600 animate-pulse' : 'text-indigo-500'}`} />
              <span className="hidden sm:inline-block">Kiosk: {isLocalOnlyMode ? 'Local (Free)' : 'Cloud Active'}</span>
              <span className="sm:hidden text-[9px]">{isLocalOnlyMode ? 'Local' : 'Cloud'}</span>
            </button>

            {!isLocalOnlyMode && (
              <div 
                onClick={handleManualConnectionCheck}
                className={`flex items-center space-x-1 px-2 py-1 md:px-3 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border cursor-pointer select-none transition-all hover:opacity-90 ${
                  firebaseStatus === 'connected' ? 'bg-indigo-50 border-indigo-155 text-indigo-700 hover:bg-indigo-100/80' :
                  firebaseStatus === 'connecting' ? 'bg-amber-50 border-amber-150 text-amber-700 animate-pulse' :
                  'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100/80'
                }`}
                title={firebaseError ? `Firebase Status: ${firebaseStatus}. Error: ${firebaseError}. Click to re-establish connection manually.` : "Firebase Database Online. Click to manually ping / synchronize now."}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${firebaseStatus === 'connected' ? 'bg-indigo-500 animate-pulse' : firebaseStatus === 'connecting' ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'}`} />
                <span className="hidden sm:inline">
                  Cloud DB: {firebaseStatus}{firebaseError ? ` (${firebaseError.slice(0, 15)}...)` : ''}
                </span>
                <span className="sm:hidden text-[9px]">DB: {firebaseStatus === 'connected' ? 'On' : firebaseStatus === 'connecting' ? 'Hold' : 'Off'}</span>
              </div>
            )}

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

            {/* View Layout Toggle */}
            <button
              onClick={() => {
                setLayoutMode(layoutMode === 'mobile' ? 'desktop' : 'mobile');
                setIsSidebarOpen(false);
              }}
              className="flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-50 border border-indigo-100/50 hover:bg-indigo-100 hover:border-indigo-200 text-indigo-750 rounded-xl text-xs font-bold transition-all select-none cursor-pointer"
              title={layoutMode === 'mobile' ? "Switch to Fullscreen Desktop View" : "Switch to Compact Mobile View"}
            >
              <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline-block">{layoutMode === 'mobile' ? 'Desktop View' : 'Mobile View'}</span>
            </button>

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
                        <span>{loggedInEmployee ? 'Alerts' : 'Shift Alerts'}</span>
                      </h3>
                      <div className="flex items-center space-x-1.5 shrink-0">
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
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer hover:underline"
                          >
                            Read All
                          </button>
                        )}
                        {filteredNotifications.length > 0 && (
                          <>
                            {filteredNotifications.filter(n => !isNotificationRead(n)).length > 0 && (
                              <span className="text-slate-250 text-[10px] select-none">|</span>
                            )}
                            <button
                              onClick={async () => {
                                if (confirm("Are you sure you want to delete all alert notifications? (क्या आप सभी नोटिस और अलर्ट हटाना चाहते हैं?)")) {
                                  await handleClearAllNotifications();
                                  setIsNotificationDropdownOpen(false);
                                }
                              }}
                              className="text-[10px] text-rose-650 hover:text-rose-800 font-extrabold cursor-pointer hover:underline"
                            >
                              Clear All
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                      {filteredNotifications.length === 0 ? (
                        <p className="text-[10px] text-slate-400 font-mono text-center py-6">No notifications collected today.</p>
                      ) : (
                        filteredNotifications.slice(0, 5).map(notif => {
                          const hasBeenRead = isNotificationRead(notif);
                          return (
                            <div key={notif.id} className={`p-2.5 rounded-xl border text-[11px] leading-normal space-y-0.5 relative group ${hasBeenRead ? 'bg-slate-50/50 border-slate-100 text-slate-500' : 'bg-rose-50/20 border-rose-100 text-slate-700 font-medium'}`}>
                              <div className="flex items-center justify-between font-bold text-slate-800 pr-6">
                                <span className="truncate max-w-[130px]">{notif.title}</span>
                                <span className="text-[8px] font-mono text-slate-400 font-normal shrink-0">{notif.timestamp}</span>
                              </div>
                              <p className="text-[10px] text-slate-600 leading-normal font-sans pr-6">{notif.message}</p>
                              
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleDeleteNotification(notif.id);
                                }}
                                className="absolute right-2 top-2.5 p-1 bg-slate-50 hover:bg-rose-100/50 text-slate-400 hover:text-rose-700 rounded-lg transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Delete notification"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
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
          {isLocalOnlyMode && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-3xs animate-fadeIn select-none print:hidden">
              <div className="flex items-start md:items-center space-x-3.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl shrink-0 flex items-center justify-center border border-amber-200/50">
                  <Zap className="w-5 h-5 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-snug flex items-center gap-1.5 font-sans">
                    <span>Local Mode Active (बिलकुल फ्री - सुरक्षित मोड)</span>
                    <span className="px-1.5 py-0.5 bg-amber-200 border border-amber-300 text-amber-900 rounded font-mono text-[9px] font-bold tracking-normal">ZERO-BILLING</span>
                  </h4>
                  <p className="text-[11px] text-slate-655 mt-1 leading-relaxed max-w-2xl font-medium">
                    The app is running offline in your browser to save your Firestore daily free reads limit. All attendance, employees data, leaves, rules & costs are saved completely for free! You do not need to enter payment card details.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm("Would you like to turn back on Cloud Firebase sync mode? Realtime subscription reads might resume.")) {
                    localStorage.removeItem('apex_local_only_mode');
                    window.location.reload();
                  }
                }}
                className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all shrink-0 hover:shadow-xs active:scale-95"
              >
                Switch to Cloud Mode
              </button>
            </div>
          )}
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
              onUpdateEmployee={handleUpdateEmployee}
              settings={settings}
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
              onClearAllEmployees={handleClearAllEmployees}
              settings={settings}
            />
          )}

          {currentView === 'roster' && (
            <AttendanceRosterView
              employees={employees}
              attendance={attendance}
              settings={settings}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              employees={employees}
              attendance={attendance}
              settings={settings}
              expenses={expenses}
              onAddAttendance={handleAddAttendance}
              onUpdateAttendance={handleUpdateAttendance}
              onClearAttendance={handleClearAllAttendance}
            />
          )}

          {currentView === 'rules' && (
            <CompanyRules
              onRaiseNotification={handleRaiseNotification}
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
              onDeleteNotification={handleDeleteNotification}
              onClearAllNotifications={handleClearAllNotifications}
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

          {currentView === 'my-expenses' && loggedInEmployee && (
            <MyExpensesView
              loggedInEmployee={loggedInEmployee}
              expenses={expenses}
            />
          )}

          {currentView === 'expenses-admin' && (
            <ExpenseManagementView
              employees={employees}
              expenses={expenses}
              onAddNotification={handleRaiseNotification}
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
                  Employee transactions registered further than <strong>200 meters</strong> of Calitech HQ (26.118557, 91.539601) are automatically captured below:
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
      {loggedInEmployee && (() => {
        const todayStr = getLocalDateString(new Date());
        const loggedInEmpTodayRecord = attendance.find(
          (rec) => rec.employeeId === loggedInEmployee.id && rec.date === todayStr
        );
        const isCheckedInButNoWorkLocation = 
          loggedInEmpTodayRecord && 
          (loggedInEmpTodayRecord.entryTime || loggedInEmpTodayRecord.entryTime2) && 
          !loggedInEmpTodayRecord.selectedWorkLocation;
          
        if (isCheckedInButNoWorkLocation) {
          return (
            <WorkLocationModal
              employeeName={loggedInEmployee.name}
              onConfirm={(confirmedLoc) => {
                const updatedRecord = {
                  ...loggedInEmpTodayRecord,
                  selectedWorkLocation: confirmedLoc
                };
                handleUpdateAttendance(updatedRecord);
              }}
            />
          );
        }
        return null;
      })()}
      </div>
    </div>
  );
}
