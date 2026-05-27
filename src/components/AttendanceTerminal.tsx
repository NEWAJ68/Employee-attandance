import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  Utensils, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  History,
  Info,
  Bell,
  Volume2,
  Timer,
  Moon,
  MoonStar,
  UtensilsCrossed,
  Soup
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';
import { calculateAttendanceMetrics } from '../utils/calculations';

interface AttendanceTerminalProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  onAddAttendance: (record: AttendanceRecord) => void;
  onUpdateAttendance: (record: AttendanceRecord) => void;
  settings: Settings;
  onRaiseNotification?: (title: string, message: string, type: 'info' | 'warning' | 'alert' | 'success', employeeId?: string) => void;
  loggedInEmployee?: Employee | null;
}

export default function AttendanceTerminal({
  employees,
  attendance,
  onAddAttendance,
  onUpdateAttendance,
  settings,
  onRaiseNotification,
  loggedInEmployee,
}: AttendanceTerminalProps) {
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isAutoPunchModalOpen, setIsAutoPunchModalOpen] = useState(false);

  useEffect(() => {
    if (loggedInEmployee) {
      setSelectedEmpId(loggedInEmployee.id);
    }
  }, [loggedInEmployee]);

  // Notifications permission state
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });

  // Reminders triggers
  const [reminderType, setReminderType] = useState<'Clock-In' | 'Clock-Out'>('Clock-In');
  const [reminderDelay, setReminderDelay] = useState<number>(5); // Default 5 seconds for fast test simulation
  const [activeReminders, setActiveReminders] = useState<{ id: string; type: string; time: string }[]>([]);

  // Filter only active employees for check-in dropdown
  const activeEmployees = employees.filter((emp) => emp.status === 'Active');

  // Request browser permission for push updates
  const handleAuthorizeNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      triggerNotification('error', 'Browser does not support standard Web Notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === 'granted') {
        triggerNotification('success', 'Desktop push notifications authorized successfully!');
        if (onRaiseNotification) {
          onRaiseNotification('Push Authorized', 'Real-time device notifications are now fully operational.', 'success');
        }
      } else {
        triggerNotification('error', 'Push permission rejected by browser settings.');
      }
    } catch (e) {
      console.error('Request permission failed', e);
    }
  };

  // Schedule Reminder timer
  const handleScheduleReminder = () => {
    if (!selectedEmpId) {
      triggerNotification('error', 'Please select an employee profile to associate the reminder.');
      return;
    }

    const employeeName = employees.find(e => e.id === selectedEmpId)?.name || '';
    const delayMs = reminderDelay * 1000;
    
    const reminderId = `RM-${Date.now()}`;
    const timestampStr = new Date(Date.now() + delayMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Add to active schedule
    setActiveReminders(prev => [...prev, { id: reminderId, type: reminderType, time: timestampStr }]);
    triggerNotification('success', `Scheduled ${reminderType} reminder for ${employeeName} in ${reminderDelay}s.`);

    setTimeout(() => {
      // Fire notification
      const alarmTitle = `${reminderType} Shift Reminder!`;
      const alarmBody = `Attention ${employeeName}, this is your scheduled reminder to log your ${reminderType} stamp.`;

      // 1. Desktop Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(alarmTitle, {
            body: alarmBody,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.log('Fired simulated alert', alarmBody);
        }
      }

      // 2. Global notification history record
      if (onRaiseNotification) {
        onRaiseNotification(alarmTitle, alarmBody, 'info', selectedEmpId);
      }

      // 3. Audio cue simulation using standardized modern Web Audio API
      if (typeof window !== 'undefined') {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 pitch
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.18);
        } catch (err) {
          console.log('Audio disabled in sandboxed document scope');
        }
      }

      // 4. Slide alert banner trigger
      triggerNotification('success', `⏰ ${alarmTitle} - For ${employeeName}: ${reminderType} stamp overdue alert!`);

      // Clear from reminders list
      setActiveReminders(prev => prev.filter(r => r.id !== reminderId));
    }, delayMs);
  };

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = currentTime.toISOString().split('T')[0];
  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Get current state of selected employee for today
  const getTodayRecord = (empId: string): AttendanceRecord | undefined => {
    return attendance.find((record) => record.date === todayStr && record.employeeId === empId);
  };

  const getEmployeeStatus = (empId: string): 'not-entered' | 'active-working' | 'on-lunch' | 'exited' | 'active-working-shift2' | 'on-dinner' | 'fully-exited' => {
    const record = getTodayRecord(empId);
    if (!record) return 'not-entered';
    
    // Shift 2 active checks
    if (record.entryTime2) {
      if (record.exitTime2) return 'fully-exited';
      if (record.dinnerOut && !record.dinnerIn) return 'on-dinner';
      return 'active-working-shift2';
    }

    // Shift 1 checks
    if (record.lunchOut && !record.lunchIn) return 'on-lunch';
    if (record.exitTime) return 'exited'; // Checked out of Shift 1, available for Shift 2
    return 'active-working';
  };

  const selectedEmpStatus = selectedEmpId ? getEmployeeStatus(selectedEmpId) : null;
  const currentRecord = selectedEmpId ? getTodayRecord(selectedEmpId) : null;
  const selectedEmpName = selectedEmpId ? employees.find(e => e.id === selectedEmpId)?.name || '' : '';

  useEffect(() => {
    if (loggedInEmployee && getEmployeeStatus(loggedInEmployee.id) === 'not-entered') {
      setIsAutoPunchModalOpen(true);
    } else {
      setIsAutoPunchModalOpen(false);
    }
  }, [loggedInEmployee, attendance]);

  const triggerNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification({ type: null, message: '' });
    }, 4500);
  };

  const handleEntryCheckIn = () => {
    if (!selectedEmpId) return;
    
    // Prevent duplicate ENTRY on same day
    if (selectedEmpStatus !== 'not-entered') {
      triggerNotification('error', 'This employee has already checked in for today.');
      return;
    }

    const isNightShift = timeStr >= '14:00';

    const newRecord: AttendanceRecord = {
      date: todayStr,
      employeeId: selectedEmpId,
      employeeName: selectedEmpName,
      entryTime: isNightShift ? '' : timeStr,
      lunchOut: '',
      lunchIn: '',
      exitTime: '',
      entryTime2: isNightShift ? timeStr : '',
      exitTime2: '',
      dinnerOut: '',
      dinnerIn: '',
      totalHours: 0,
      overtime: 0,
      status: isNightShift ? 'Night Shift' : (settings.workStartHour && timeStr > settings.workStartHour ? 'Late Entry' : 'Present'),
    };

    onAddAttendance(newRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} checked in successfully for ${isNightShift ? 'Night Shift' : 'Day Shift'} at ${timeStr}.`
    );
  };

  const handleLunchOut = () => {
    if (!selectedEmpId || !currentRecord) return;

    // Flexible mode: Check-in is required, but they can go to lunch anytime before exiting
    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited') {
      triggerNotification('error', 'Employee must be checked in and active before departing for lunch.');
      return;
    }

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchOut: timeStr,
      lunchIn: '', // Clear previous return stamp to allow flexible multiple breaks
      status: 'On Lunch',
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} departed for lunch break dynamically at ${timeStr}.`);
  };

  const handleLunchIn = () => {
    if (!selectedEmpId || !currentRecord) return;

    // Flexible mode: Can return from lunch anytime they are checked in and have a departed stamp
    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited' || !currentRecord.lunchOut) {
      triggerNotification('error', 'Employee has no active lunch departure registered to return from.');
      return;
    }

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchIn: timeStr,
      status: 'Present',
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} returned from lunch at ${timeStr}. Welcome back!`);
  };

  const handleDinnerOut = () => {
    if (!selectedEmpId || !currentRecord) return;

    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'exited' || selectedEmpStatus === 'fully-exited') {
      triggerNotification('error', 'Employee must be working in an active shift to go for dinner.');
      return;
    }

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerOut: timeStr,
      dinnerIn: '', // Clear previous return stamp to allow multiple breaks
      status: 'On Dinner',
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} departed for dinner break at ${timeStr}. Enjoy your meal!`);
  };

  const handleDinnerIn = () => {
    if (!selectedEmpId || !currentRecord) return;

    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited' || !currentRecord.dinnerOut) {
      triggerNotification('error', 'Employee has no active dinner departure registered to return from.');
      return;
    }

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerIn: timeStr,
      status: 'Present',
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} returned from dinner break at ${timeStr}. Welcome back to work!`);
  };

  const handleEntry2CheckIn = () => {
    if (!selectedEmpId || !currentRecord) return;

    if (selectedEmpStatus !== 'exited') {
      triggerNotification('error', 'Employee must checkout from first shift before starting the dynamic double / night shift.');
      return;
    }

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      entryTime2: timeStr,
      dinnerOut: '',
      dinnerIn: '',
      exitTime2: '',
      status: 'Double Shift Active',
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} registered second shift entry dynamically at ${timeStr}.`);
  };

  const handleExitCheckOut = () => {
    if (!selectedEmpId || !currentRecord) return;

    // Prevent duplicate EXIT before ENTRY
    if (selectedEmpStatus === 'not-entered') {
      triggerNotification('error', 'Employee has not recorded their initial entry checked-in status today.');
      return;
    }

    if (selectedEmpStatus === 'exited' || selectedEmpStatus === 'fully-exited') {
      triggerNotification('error', 'Employee has already checked out of this shift for today.');
      return;
    }

    // Capture precise metrics
    const { totalHours, overtime, statusFlags } = calculateAttendanceMetrics(
      currentRecord.entryTime,
      timeStr,
      currentRecord.lunchOut,
      currentRecord.lunchIn || (currentRecord.lunchOut ? timeStr : ''), // auto balance lunch in if they check out directly
      settings
    );

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchIn: currentRecord.lunchOut && !currentRecord.lunchIn ? timeStr : currentRecord.lunchIn,
      exitTime: timeStr,
      totalHours,
      overtime,
      status: statusFlags.join(', '),
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} checked out of Shift 1 at ${timeStr}. Total logged: ${totalHours} hrs (Overtime: ${overtime} hrs)`
    );
  };

  const handleExit2CheckOut = () => {
    if (!selectedEmpId || !currentRecord || !currentRecord.entryTime2) return;

    if (selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'on-dinner') {
      triggerNotification('error', 'Employee is not actively working on Shift 2.');
      return;
    }

    // Capture precise metrics for both shifts
    const { totalHours, overtime, statusFlags } = calculateAttendanceMetrics(
      currentRecord.entryTime,
      currentRecord.exitTime,
      currentRecord.lunchOut,
      currentRecord.lunchIn,
      settings,
      currentRecord.entryTime2,
      timeStr,
      currentRecord.dinnerOut,
      currentRecord.dinnerIn || (currentRecord.dinnerOut ? timeStr : '') // auto balance dinner return
    );

    const updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerIn: currentRecord.dinnerOut && !currentRecord.dinnerIn ? timeStr : currentRecord.dinnerIn,
      exitTime2: timeStr,
      totalHours,
      overtime,
      status: statusFlags.join(', '),
    };

    onUpdateAttendance(updatedRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} completed Shift 2 at ${timeStr}. Cumulative today: ${totalHours} hrs (Overtime: ${overtime} hrs)`
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8" id="attendance-terminal-container">
      {/* Visual Header */}
      <div className="bg-gradient-to-tr from-[#4f46e5] to-[#7c3aed] rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Clock className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <span className="bg-white/20 text-white font-semibold px-3 py-1 rounded-full text-xs uppercase tracking-wider border border-white/10">
              {loggedInEmployee ? 'My Personalized Employee Cabin' : 'Company Attendance Terminal'}
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-2 text-white tracking-tight">
              {loggedInEmployee ? `Welcome, ${loggedInEmployee.name}!` : 'Direct Verification Desk'}
            </h2>
            <p className="text-indigo-100 text-sm mt-1 max-w-lg">
              {loggedInEmployee 
                ? 'You are signed in securely. Log your punch card in real-time or examine logs below.' 
                : 'Authorized kiosk for employees to track daily work logs. Ensure you select your correct profile name before hitting status markers.'}
            </p>
          </div>
          <div className="text-left md:text-right bg-white/10 px-6 py-4 rounded-xl border border-white/15 backdrop-blur-sm">
            <p className="text-[10px] text-indigo-100 font-semibold uppercase tracking-widest font-mono opacity-90">
              System Time (UTC)
            </p>
            <p className="text-3xl md:text-4xl font-extrabold tracking-wider font-mono text-white mt-0.5" id="live-time-ticker">
              {timeStr}
            </p>
            <p className="text-xs text-indigo-100 font-mono mt-1 opacity-80">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {notification.type && (
        <div className={`p-4 rounded-xl shadow-md flex items-center space-x-3 border animate-bounce ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100/80 text-emerald-800' 
            : 'bg-rose-50 border-rose-100/80 text-rose-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Terminal interface */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Selector Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-4 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Select Your Name</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Find and choose your profile name in the dropdown below to authorize check-ins or lunch clock counters.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 font-mono">
                  Identify Profile
                </label>
                {loggedInEmployee ? (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider font-mono">My Account Active</span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-850">{loggedInEmployee.name}</h4>
                      <p className="text-3xs text-slate-500 font-mono mt-0.5">{loggedInEmployee.id} • {loggedInEmployee.department}</p>
                    </div>
                  </div>
                ) : (
                  <select
                    id="employee-select"
                    value={selectedEmpId}
                    onChange={(e) => {
                      setSelectedEmpId(e.target.value);
                      setNotification({ type: null, message: '' });
                    }}
                    className="w-full px-3.5 py-3 border border-slate-200 rounded-xl shadow-sm bg-slate-50 focus:outline-none focus:ring-2 focus:focus:ring-indigo-500 select-none text-sm transition-all text-slate-700"
                  >
                    <option value="">-- Choose Your Profile --</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedEmpId && (
                <div className="p-4 bg-slate-50 border border-slate-100/80 rounded-xl space-y-2.5 animate-fadeIn">
                  <span className="text-2xs font-mono uppercase tracking-wider font-bold text-indigo-600">
                    Live Shift Balance
                  </span>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Registered Status:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedEmpStatus === 'not-entered' && 'Not Entered'}
                      {selectedEmpStatus === 'active-working' && 'Day Shift Active'}
                      {selectedEmpStatus === 'on-lunch' && 'On Lunch Break'}
                      {selectedEmpStatus === 'exited' && 'Day Shift Concluded'}
                      {selectedEmpStatus === 'active-working-shift2' && 'Night Shift Active'}
                      {selectedEmpStatus === 'on-dinner' && 'On Dinner Break'}
                      {selectedEmpStatus === 'fully-exited' && 'Night Shift Concluded'}
                    </span>
                  </div>
                  
                  <div className="border-t border-slate-200/60 my-2 pt-2 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Shift 1 (Day / Early Duty)</span>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Clock In:</span>
                      <span className="font-mono text-slate-800 font-semibold">
                        {currentRecord?.entryTime || '--:--'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Lunch Break:</span>
                      <span className="font-mono text-slate-800">
                        {currentRecord?.lunchOut ? `${currentRecord.lunchOut} - ${currentRecord.lunchIn || 'Active'}` : 'Not Taken'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Clock Out:</span>
                      <span className="font-mono text-slate-800 font-semibold">
                        {currentRecord?.exitTime || '--:--'}
                      </span>
                    </div>
                  </div>

                  {(currentRecord?.entryTime2 || selectedEmpStatus === 'exited' || selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner' || selectedEmpStatus === 'fully-exited') && (
                    <div className="border-t border-slate-200/60 my-2 pt-2 space-y-1.5 animate-fadeIn">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 block font-mono">Shift 2 (Night Duty / OT)</span>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Clock In (S2):</span>
                        <span className="font-mono text-indigo-600 font-semibold">
                          {currentRecord?.entryTime2 || '--:--'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Dinner Break:</span>
                        <span className="font-mono text-slate-805">
                          {currentRecord?.dinnerOut ? `${currentRecord.dinnerOut} - ${currentRecord.dinnerIn || 'Active'}` : 'Not Taken'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Clock Out (S2):</span>
                        <span className="font-mono text-indigo-600 font-semibold">
                          {currentRecord?.exitTime2 || '--:--'}
                        </span>
                      </div>
                    </div>
                  )}

                  {currentRecord && (currentRecord.totalHours > 0) && (
                    <div className="border-t border-indigo-100 bg-indigo-50/40 p-2 rounded-lg text-xs space-y-1 mt-2">
                      <div className="flex justify-between text-slate-700">
                        <span>Cumulative Hours:</span>
                        <span className="font-bold text-slate-900 font-mono">{currentRecord.totalHours} hrs</span>
                      </div>
                      {currentRecord.overtime > 0 && (
                        <div className="flex justify-between text-amber-805 font-semibold">
                          <span>Overtime Credit:</span>
                          <span className="font-black font-mono">+{currentRecord.overtime} hrs</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 text-slate-400 mt-6 md:mt-0 text-3xs font-mono leading-relaxed uppercase flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>Secured biometric alternative network API</span>
          </div>
        </div>

        {/* Action Controls Grid */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-6 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Kiosk Action Controllers</span>
          </div>

          {!selectedEmpId ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-55/40 text-slate-500">
              <LogIn className="w-10 h-10 text-slate-300 stroke-1 mb-3" />
              <p className="font-medium text-xs md:text-sm">No Employee Profile Selected</p>
              <p className="text-2xs text-slate-400 mt-1 leading-normal max-w-xs">
                Please pick your user profile name in the side drop-down panel to enable time stamp operations.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SHIFT 1 WORKSPACE */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-250/60 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded-md font-mono">SHIFT 1</span>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Day Shift</h3>
                  </div>
                  <span className={`h-2 w-2 rounded-full ${
                    selectedEmpStatus === 'active-working' || selectedEmpStatus === 'on-lunch' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* ENTRY BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-entry"
                    onClick={handleEntryCheckIn}
                    disabled={selectedEmpStatus !== 'not-entered'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'not-entered'
                        ? 'border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-900 shadow-sm cursor-pointer hover:border-indigo-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-indigo-600 block">
                        Clock Entry
                      </span>
                      <span className="text-sm font-extrabold block">ENTRY PUNCH</span>
                      <span className="text-[10px] text-slate-500 block">
                        {timeStr >= '14:00' ? (
                          <span className="text-indigo-650 font-semibold font-mono">Starts Night Shift (≥ 14:00)</span>
                        ) : (
                          <span>Starts Day Shift (&lt; 14:00)</span>
                        )}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'not-entered' ? 'bg-indigo-600 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <LogIn className="w-4 h-4" />
                    </div>
                  </button>

                  {/* EXIT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-exit"
                    onClick={handleExitCheckOut}
                    disabled={selectedEmpStatus !== 'active-working' && selectedEmpStatus !== 'on-lunch'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'active-working' || selectedEmpStatus === 'on-lunch'
                        ? 'border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-900 shadow-sm cursor-pointer hover:border-indigo-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-indigo-600 block">
                        Wrap-Up S1
                      </span>
                      <span className="text-sm font-extrabold block">EXIT PUNCH</span>
                      <span className="text-[10px] text-slate-500 block">Clock out standard.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'active-working' || selectedEmpStatus === 'on-lunch' ? 'bg-indigo-600 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <LogOut className="w-4 h-4" />
                    </div>
                  </button>
                </div>

                {/* Lunch break row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
                  {/* LUNCH OUT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-lunchout"
                    onClick={handleLunchOut}
                    disabled={selectedEmpStatus !== 'active-working'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'active-working'
                        ? 'border-amber-100 bg-amber-50/45 hover:bg-amber-50 text-amber-900 shadow-sm cursor-pointer hover:border-amber-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-amber-600 block">
                        Lunch Out
                      </span>
                      <span className="text-sm font-extrabold block">DEPART BREAK</span>
                      <span className="text-[10px] text-slate-500 block">Start lunch rest hour.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'active-working' ? 'bg-amber-505 bg-amber-500 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Utensils className="w-4 h-4" />
                    </div>
                  </button>

                  {/* LUNCH IN BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-lunchin"
                    onClick={handleLunchIn}
                    disabled={selectedEmpStatus !== 'on-lunch'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'on-lunch'
                        ? 'border-teal-100 bg-teal-50/45 hover:bg-teal-50 text-teal-900 shadow-sm cursor-pointer hover:border-teal-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-teal-600 block">
                        Lunch In
                      </span>
                      <span className="text-sm font-extrabold block">RETURN BREAK</span>
                      <span className="text-[10px] text-slate-500 block">Back from lunch rest.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'on-lunch' ? 'bg-teal-600 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Coffee className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>

              {/* SHIFT 2 WORKSPACE (DOUBLE SHIFT / NIGHT DUTY) */}
              <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50 space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-md font-mono">SHIFT 2</span>
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Night Shift</h3>
                  </div>
                  <span className={`h-2 w-2 rounded-full ${
                    selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'
                  }`}></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* S2 ENTRY BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-entry2"
                    onClick={handleEntry2CheckIn}
                    disabled={selectedEmpStatus !== 'exited'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'exited'
                        ? 'border-indigo-200 bg-indigo-100/20 hover:bg-indigo-100/40 text-indigo-950 shadow-sm cursor-pointer hover:border-indigo-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-indigo-700 block">
                        Clock Shift 2
                      </span>
                      <span className="text-sm font-extrabold block">START SHIFT 2</span>
                      <span className="text-[10px] text-slate-500 block">Log second shift / night.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'exited' ? 'bg-indigo-700 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Moon className="w-4 h-4" />
                    </div>
                  </button>

                  {/* S2 EXIT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-exit2"
                    onClick={handleExit2CheckOut}
                    disabled={selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'on-dinner'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner'
                        ? 'border-indigo-200 bg-indigo-100/20 hover:bg-indigo-100/40 text-indigo-950 shadow-sm cursor-pointer hover:border-indigo-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-indigo-700 block">
                        Wrap-Up S2
                      </span>
                      <span className="text-sm font-extrabold block">FINISH SHIFT 2</span>
                      <span className="text-[10px] text-slate-500 block">Conclude second shift / OT.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner' ? 'bg-indigo-700 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <MoonStar className="w-4 h-4" />
                    </div>
                  </button>
                </div>

                {/* Dinner Break Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
                  {/* DINNER OUT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-dinnerout"
                    onClick={handleDinnerOut}
                    disabled={selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'active-working'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'active-working'
                        ? 'border-rose-100 bg-rose-50/45 hover:bg-rose-50 text-rose-900 shadow-sm cursor-pointer hover:border-rose-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-rose-600 block">
                        Dinner Out
                      </span>
                      <span className="text-sm font-extrabold block">DINNER DEPART</span>
                      <span className="text-[10px] text-slate-500 block">Night shift dinner break.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'active-working' ? 'bg-rose-500 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <UtensilsCrossed className="w-4 h-4" />
                    </div>
                  </button>

                  {/* DINNER IN BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-dinnerin"
                    onClick={handleDinnerIn}
                    disabled={selectedEmpStatus !== 'on-dinner'}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'on-dinner'
                        ? 'border-teal-100 bg-teal-50/45 hover:bg-teal-50 text-teal-900 shadow-sm cursor-pointer hover:border-teal-200'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-teal-600 block">
                        Dinner In
                      </span>
                      <span className="text-sm font-extrabold block">DINNER RETURN</span>
                      <span className="text-[10px] text-slate-500 block">Back from night dinner.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'on-dinner' ? 'bg-teal-500 text-white group-hover:scale-105' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Soup className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Guidelines notes inside Kiosk Action Box */}
          <div className="mt-6 bg-slate-50 border border-slate-100 p-4 rounded-xl text-2xs text-slate-500 leading-normal flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 block">Automatic Integrity Enforcement:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 font-mono text-3xs">
                <li>Daily entries capped: You cannot double entry on a matching date calendar card.</li>
                <li>Action dependency flow: System guarantees Lunch Returns and Exit Punches only trigger following structural Entry Punches.</li>
                <li>Overtime calculation starts after 8 working hours automatically. Lunch rest margins are deducted.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Wide-Width Push Notifications & Reminders Desk */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Device Notification Desk</span>
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure push reminders for the Attendance Web App. Authorize standard browser push notifications or simulate triggers so you never miss shift logs.
          </p>
          <div className="pt-2">
            <button
              onClick={handleAuthorizeNotifications}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-xl border cursor-pointer transition-all ${
                permissionStatus === 'granted'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/50'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              <Volume2 className="w-4 h-4 text-indigo-500" />
              <span>
                {permissionStatus === 'granted' ? 'Native Push: Authorized ✓' : 'Authorize Browser Push'}
              </span>
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-slate-400" />
            <span>Simulate Active Employee Reminders</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-3xs text-slate-400 uppercase tracking-widest font-mono font-bold mb-1.5">Reminder Action</label>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value as any)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50 font-semibold focus:ring-1 focus:ring-indigo-550 focus:border-indigo-500"
              >
                <option value="Clock-In">Clock-In Reminder</option>
                <option value="Clock-Out">Clock-Out Reminder</option>
              </select>
            </div>

            <div>
              <label className="block text-3xs text-slate-400 uppercase tracking-widest font-mono font-bold mb-1.5">Delay Duration</label>
              <select
                value={reminderDelay}
                onChange={(e) => setReminderDelay(Number(e.target.value))}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50 font-semibold focus:ring-1 focus:ring-indigo-550 focus:border-indigo-500"
              >
                <option value={5}>5 Seconds (Fast Test)</option>
                <option value={30}>30 Seconds</option>
                <option value={300}>5 Minutes</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleScheduleReminder}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-colors shadow-sm font-sans"
              >
                Schedule Reminder Clock
              </button>
            </div>
          </div>

          {activeReminders.length > 0 && (
            <div className="p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-xl space-y-2">
              <p className="text-2xs font-mono font-bold text-indigo-600 uppercase tracking-wider">Armed Reminder Schedules</p>
              <div className="space-y-1 font-sans">
                {activeReminders.map(rem => (
                  <div key={rem.id} className="text-2xs text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                      <span>Target Account: {employees.find(e => e.id === selectedEmpId)?.name}</span>
                    </span>
                    <span className="font-semibold text-slate-800">Trigger standard WebPush alert at {rem.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Automated Entry Punch Popup Modal */}
      {isAutoPunchModalOpen && loggedInEmployee && (
        <div id="automatic-checkin-popup-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn transition-all">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-indigo-50/50 relative overflow-hidden text-center space-y-6 animate-scaleIn">
            
            {/* Ambient Background decoration */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-indigo-50 rounded-full blur-xl opacity-80 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 bg-teal-50 rounded-full blur-xl opacity-80 pointer-events-none"></div>

            <div className="flex justify-center">
              <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 animate-pulse relative">
                <Clock className="w-10 h-10" />
                <span className="absolute -top-1 -right-1 bg-emerald-500 rounded-full h-3 w-3 border-2 border-white"></span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono">
                Entry Punch Pending
              </span>
              <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                Good Day, {loggedInEmployee.name}! 👋
              </h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                You just logged into your personal attendance cabinet. Let's record your shift check-in stamp to initiate tracking correctly.
              </p>
            </div>

            {/* Current interactive metrics and clock */}
            <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center space-y-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 font-mono">Current Terminal Time</span>
              <span className="text-2xl font-black font-mono text-slate-800 tracking-widest">{timeStr}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                id="popup-btn-punch-in"
                onClick={() => {
                  handleEntryCheckIn();
                  setIsAutoPunchModalOpen(false);
                }}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold rounded-2xl text-sm transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>PUNCH ENTRY NOW</span>
              </button>

              <button
                type="button"
                id="popup-btn-dismiss"
                onClick={() => setIsAutoPunchModalOpen(false)}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-95 text-slate-500 hover:text-slate-800 font-bold rounded-xl text-2xs uppercase tracking-wider transition-all border border-slate-200 cursor-pointer"
              >
                Dismiss & View Cabin
              </button>
            </div>

            <div className="text-[9px] text-slate-400 font-mono uppercase tracking-widest pt-1">
              Apex Workforce Suite • Live
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
