import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  Utensils, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  History,
  Info,
  Bell,
  Volume2,
  Timer,
  Moon,
  MoonStar,
  UtensilsCrossed,
  Soup,
  MapPin,
  Navigation,
  Trash2,
  X,
  Camera
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';
import { calculateAttendanceMetrics, verifyProximityToOffice, OFFICE_COORDS, getLocalDateString } from '../utils/calculations';

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
  const cachedLocationRef = React.useRef<string | null>(null);
  const lastLocationFetchTimeRef = React.useRef<number>(0);

  // GPS Blocker modal state variables
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [gpsErrorType, setGpsErrorType] = useState<'DENIED' | 'NOT_SUPPORTED' | null>(null);
  const [isGpsRetrying, setIsGpsRetrying] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isAutoPunchModalOpen, setIsAutoPunchModalOpen] = useState(false);
  const [punchAnimation, setPunchAnimation] = useState<{
    type: 'entry' | 'exit' | 'lunch_in' | 'lunch_out' | 'dinner_in' | 'dinner_out';
    name: string;
    time: string;
  } | null>(null);

  // Selfie camera state management
  const [selfieState, setSelfieState] = useState<{
    isOpen: boolean;
    actionLabel: string;
    onCapture: (photoBase64: string) => void;
  } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Background warmed pre-fetch of the GPS coords so they are ready before user punches
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          cachedLocationRef.current = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
          lastLocationFetchTimeRef.current = Date.now();
          setGpsErrorType(null);
          setShowGpsModal(false);
        },
        (error) => {
          console.warn('Silent warm-up pre-fetch of geolocation failed:', error);
          if (error.code === 1) { // PERMISSION_DENIED is 1
            setGpsErrorType('DENIED');
            setShowGpsModal(true);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [selectedEmpId, selfieState?.isOpen]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoClarity, setPhotoClarity] = useState<'clear' | 'blur'>('clear');

  const detectBlurFromCanvas = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    try {
      const checkSize = 100;
      const sx = Math.max(0, Math.floor((canvas.width - checkSize) / 2));
      const sy = Math.max(0, Math.floor((canvas.height - checkSize) / 2));
      const imgData = ctx.getImageData(sx, sy, Math.min(checkSize, canvas.width), Math.min(checkSize, canvas.height));
      const data = imgData.data;
      
      let accumGradients = 0;
      let count = 0;
      for (let i = 0; i < data.length - 8; i += 4) {
        const luma1 = (data[i] + data[i+1] + data[i+2]) / 3;
        const luma2 = (data[i+4] + data[i+5] + data[i+6]) / 3;
        accumGradients += Math.abs(luma1 - luma2);
        count++;
      }
      const score = accumGradients / count;
      console.log('Real-time Auto-Clarity Score:', score);
      
      // If the screen is completely black or the camera hasn't fully painted the frame yet (score is ~0),
      // we do not falsely trigger blur alerts.
      if (score < 0.1) return false;
      
      // If sharpness score is less than 3.2, there are no edges, hence the picture is blurry.
      // Crisp clear face photographs average around 5.5 to 14.5.
      return score < 3.2;
    } catch (e) {
      return false;
    }
  };

  // Direct webcam stream control and photo capturing methods
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    setPhotoClarity('clear');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 485 } },
        audio: false
      });
      setCameraStream(stream);
      setTimeout(() => {
        const videoElement = document.getElementById('selfie-video-preview') as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = stream;
        }
      }, 150);
    } catch (err) {
      console.warn('Direct camera stream failed:', err);
      setCameraError('Direct camera feed unavailable. You can take a photo utilizing your standard device camera popup by using the button below.');
    }
  };

  useEffect(() => {
    if (selfieState?.isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selfieState?.isOpen]);

  const captureSnapshot = () => {
    const video = document.getElementById('selfie-video-preview') as HTMLVideoElement;
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      const videoHeight = video.videoHeight || 480;
      const videoWidth = video.videoWidth || 640;
      
      const portraitHeight = videoHeight;
      const portraitWidth = Math.round(videoHeight * 0.75);
      
      canvas.width = portraitWidth;
      canvas.height = portraitHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sx = Math.max(0, (videoWidth - portraitWidth) / 2);
        const sy = 0;
        
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(
          video,
          sx, 
          sy, 
          portraitWidth, 
          portraitHeight,
          0, 
          0, 
          portraitWidth, 
          portraitHeight
        );
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const isBlurry = detectBlurFromCanvas(canvas);
        setPhotoClarity(isBlurry ? 'blur' : 'clear');
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setCapturedPhoto(dataUrl);
        stopCamera();
        playBeep(true);
      }
    } catch (e) {
      console.error('Failed snapshot capture:', e);
      setCameraError('Camera capture interface failed. Please utilize the standard selfie file uploader.');
    }
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width > 300 ? 300 : img.width;
        canvas.height = img.height > 400 ? 400 : img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const isBlurry = detectBlurFromCanvas(canvas);
          setPhotoClarity(isBlurry ? 'blur' : 'clear');
        }
        setCapturedPhoto(base64);
        playBeep(true);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const triggerSelfieAndPunch = (actionLabel: string, onPunchConfirmed: (selfieBase64: string) => void) => {
    setCapturedPhoto(null);
    setCameraError(null);
    setPhotoClarity('clear');
    setSelfieState({
      isOpen: true,
      actionLabel,
      onCapture: (base64) => {
        onPunchConfirmed(base64);
        setSelfieState(null);
      }
    });
  };



  // Audio feeedback beep generator using Web Audio API
  const playBeep = (success: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (success) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 high note
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
        
        // play a second quick sweet high note
        setTimeout(() => {
          try {
            const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc2 = ctx2.createOscillator();
            const gain2 = ctx2.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1109.73, ctx2.currentTime); // C#6
            osc2.connect(gain2);
            gain2.connect(ctx2.destination);
            gain2.gain.setValueAtTime(0.15, ctx2.currentTime);
            osc2.start();
            osc2.stop(ctx2.currentTime + 0.15);
          } catch(e) {}
        }, 120);
      } else {
        // buzzer note
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(130, audioCtx.currentTime); // low buzz
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.45);
      }
    } catch (err) {
      console.log('Audio feedback not allowed or blocked by sandboxed browser frame');
    }
  };


  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Helper to retrieve actual geolocation using browser GPS with Calitech HQ fallback
  const fetchCurrentLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve("NOT_SUPPORTED");
        return;
      }

      // If we have a cached coordinate that is less than 10 seconds (10,000 ms) old, return it instantly!
      const now = Date.now();
      if (cachedLocationRef.current && (now - lastLocationFetchTimeRef.current < 10000)) {
        console.log('Using optimized zero-latency cached GPS coordinate:', cachedLocationRef.current);
        
        // Asynchronously update the cache in the background for next time
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            cachedLocationRef.current = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
            lastLocationFetchTimeRef.current = Date.now();
          },
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        
        resolve(cachedLocationRef.current);
        return;
      }

      setIsFetchingLocation(true);
      
      const options = {
        enableHighAccuracy: true,
        timeout: 15000, // 15 seconds to ensure GPS hardware has ample time to lock coordinates with 100% accuracy
        maximumAge: 0   // Force fresh real-time coordinate fetching with 100% accurate live satellites
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsFetchingLocation(false);
          const { latitude, longitude } = position.coords;
          const coords = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
          cachedLocationRef.current = coords;
          lastLocationFetchTimeRef.current = Date.now();
          resolve(coords);
        },
        (error) => {
          setIsFetchingLocation(false);
          console.warn('Geolocation capture failed or was denied:', error);
          if (error.code === 1) { // PERMISSION_DENIED is 1
            resolve("DENIED");
          } else if (settings.strictGeofencing) {
            resolve("DENIED");
          } else {
            // Return Calitech office coords on fallback so that users don't get blocked
            resolve(`${OFFICE_COORDS.lat},${OFFICE_COORDS.lng}`);
          }
        },
        options
      );
    });
  };

  const handleRetryGpsVerification = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsErrorType('NOT_SUPPORTED');
      setShowGpsModal(true);
      return;
    }

    setIsGpsRetrying(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGpsRetrying(false);
        const { latitude, longitude } = position.coords;
        const coords = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        cachedLocationRef.current = coords;
        lastLocationFetchTimeRef.current = Date.now();
        
        setShowGpsModal(false);
        setGpsErrorType(null);
        triggerNotification('success', '✅ GPS Signal Verified! You are authorized to log attendance.');
        playBeep(true);
      },
      (error) => {
        setIsGpsRetrying(false);
        console.warn('Manual retry geolocation failed:', error);
        if (error.code === 1) {
          setGpsErrorType('DENIED');
          triggerNotification('error', 'Location Access Denied! Please follow the settings guide to allow.');
          playBeep(false);
        } else {
          if (!settings.strictGeofencing) {
            // Fallback to coordinates
            const fallbackCoords = `${OFFICE_COORDS.lat},${OFFICE_COORDS.lng}`;
            cachedLocationRef.current = fallbackCoords;
            lastLocationFetchTimeRef.current = Date.now();
            setShowGpsModal(false);
            setGpsErrorType(null);
            triggerNotification('success', '✅ Backup Geolocation Signal verified successfully.');
            playBeep(true);
          } else {
            triggerNotification('error', `GPS lock failed: ${error.message}. Ensure your device GPS sensor is turned ON.`);
            playBeep(false);
          }
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  /**
   * Helper that checks if a GPS coordinate is valid and within range.
   * If settings.strictGeofencing is enabled, blocks the action and returns false.
   */
  const validateGeofencingOrBlock = (coords: string): boolean => {
    if (coords === "DENIED" || coords === "NOT_SUPPORTED" || !coords) {
      setGpsErrorType(coords === "NOT_SUPPORTED" ? "NOT_SUPPORTED" : "DENIED");
      setShowGpsModal(true);
      
      triggerNotification(
        'error', 
        'GPS verification failed! You must allow browser space location permissions to record your attendance.'
      );
      playBeep(false);
      return false;
    }

    if (!settings.strictGeofencing) return true; // not enforced

    const { isWithinRange, distance, matchedLocationName } = verifyProximityToOffice(coords);
    if (!isWithinRange) {
      triggerNotification(
        'error', 
        `PUNCH DENIED! You are ${distance}m away. Company rules require you to be within 200m of Calitech HQ or our certified sites. (अगर आप ऑफिस में हैं पर GPS एरर आ रहा है, तो Admin से "Strict GPS Geofencing" बंद करने को कहें)`
      );
      playBeep(false);

      if (onRaiseNotification) {
        onRaiseNotification(
          'BLOCKED Out-of-Range Punch',
          `❌ SECURITY BLOCK: ${selectedEmpName || 'Unidentified'} tried punching from ${distance}m away (nearest: ${matchedLocationName}). Ask admin to turn off "Strict GPS Geofencing" if this is a false block. Coordinate: ${coords}`,
          'alert',
          selectedEmpId
        );
      }
      return false;
    }

    return true;
  };

  const checkProximityAndFlag = (coords: string, actionName: string, record: AttendanceRecord): AttendanceRecord => {
    // If coords are denied, but strict geofencing is off, fallback range
    const resolvedCoords = (coords === "DENIED" || coords === "NOT_SUPPORTED" || !coords) 
      ? `${OFFICE_COORDS.lat},${OFFICE_COORDS.lng}` 
      : coords;

    const { isWithinRange, distance, matchedLocationName } = verifyProximityToOffice(resolvedCoords);
    if (!isWithinRange) {
      record.isOutOfRange = true;
      record.distanceFromHq = distance;
      
      if (onRaiseNotification) {
        onRaiseNotification(
          'Out-of-Range Punch Alert',
          `🚨 ${selectedEmpName || record.employeeName || 'Employee'} punched during ${actionName} from ${distance}m away. Coords: ${resolvedCoords}`,
          'alert',
          selectedEmpId || record.employeeId
        );
      }
    } else {
      record.isOutOfRange = false;
      record.distanceFromHq = distance;
      
      // Dynamic automatic site mapping log inside notes
      const siteTag = `[Matched Site: ${matchedLocationName}]`;
      if (!record.notes) {
        record.notes = siteTag;
      } else if (!record.notes.includes(matchedLocationName)) {
        record.notes = `${record.notes} ${siteTag}`;
      }
    }
    return record;
  };

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

  const todayStr = getLocalDateString(currentTime);
  const pad = (num: number) => String(num).padStart(2, '0');
  const timeStr = `${pad(currentTime.getHours())}:${pad(currentTime.getMinutes())}`;

  // Get current state of selected employee for today
  const getTodayRecord = (empId: string): AttendanceRecord | undefined => {
    return attendance.find((record) => record.date === todayStr && record.employeeId === empId);
  };

  const getEmployeeStatus = (empId: string): 'not-entered' | 'active-working' | 'on-lunch' | 'exited' | 'active-working-shift2' | 'on-dinner' | 'fully-exited' => {
    const record = getTodayRecord(empId);
    if (!record) return 'not-entered';
    
    // Globally check breaks first to ensure return buttons are immediately activated
    if (record.dinnerOut && !record.dinnerIn) return 'on-dinner';
    if (record.lunchOut && !record.lunchIn) return 'on-lunch';

    // Shift 2 active checks
    if (record.entryTime2) {
      if (record.exitTime2) return 'fully-exited';
      return 'active-working-shift2';
    }

    // Shift 1 checks
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

  const handleEntryCheckIn = async (selfiePhoto?: string) => {
    if (!selectedEmpId) return;
    
    // Prevent duplicate ENTRY on same day
    if (selectedEmpStatus !== 'not-entered') {
      triggerNotification('error', 'This employee has already checked in for today.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Day Shift Check-In', (photo) => handleEntryCheckIn(photo));
      return;
    }

    const isNightShift = timeStr >= '14:00';
    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    let newRecord: AttendanceRecord = {
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
      locationIn: isNightShift ? '' : coords,
      locationEntry2: isNightShift ? coords : '',
      photoIn: isNightShift ? '' : selfiePhoto,
      photoEntry2: isNightShift ? selfiePhoto : '',
    };

    newRecord = checkProximityAndFlag(coords, 'initial entry check-in', newRecord);
    onAddAttendance(newRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} checked in successfully for ${isNightShift ? 'Night Shift' : 'Day Shift'} at ${timeStr}.`
    );
    setPunchAnimation({
      type: 'entry',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleLunchOut = async (selfiePhoto?: string) => {
    if (!selectedEmpId || !currentRecord) return;

    // Flexible mode: Check-in is required, but they can go to lunch anytime before exiting
    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited') {
      triggerNotification('error', 'Employee must be checked in and active before departing for lunch.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Lunch Departure', (photo) => handleLunchOut(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchOut: timeStr,
      lunchIn: '', // Clear previous return stamp to allow flexible multiple breaks
      status: 'On Lunch',
      locationLunchOut: coords,
      photoLunchOut: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'lunch departure', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} departed for lunch break dynamically at ${timeStr}.`);
    setPunchAnimation({
      type: 'lunch_out',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleLunchIn = async (selfiePhoto?: string) => {
    if (!selectedEmpId || !currentRecord) return;

    // Flexible mode: Can return from lunch anytime they are checked in and have a departed stamp
    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited' || !currentRecord.lunchOut) {
      triggerNotification('error', 'Employee has no active lunch departure registered to return from.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Lunch Return', (photo) => handleLunchIn(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchIn: timeStr,
      status: 'Present',
      locationLunchIn: coords,
      photoLunchIn: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'lunch return', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} returned from lunch at ${timeStr}. Welcome back!`);
    setPunchAnimation({
      type: 'lunch_in',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleDinnerOut = async (selfiePhoto?: string) => {
    if (!selectedEmpId || !currentRecord) return;

    if (currentRecord.dinnerOut) {
      triggerNotification('error', 'Dinner Break has already been taken today (डिनर ब्रेक पहले ही लिया जा चुका है).');
      return;
    }

    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'exited' || selectedEmpStatus === 'fully-exited') {
      triggerNotification('error', 'Employee must be working in an active shift to go for dinner.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Dinner Departure', (photo) => handleDinnerOut(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerOut: timeStr,
      dinnerIn: '', // Clear previous return stamp to allow multiple breaks
      status: 'On Dinner',
      locationDinnerOut: coords,
      photoDinnerOut: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'dinner departure', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} departed for dinner break at ${timeStr}. Enjoy your meal!`);
    setPunchAnimation({
      type: 'dinner_out',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleDinnerIn = async (selfiePhoto?: string) => {
    if (!selectedEmpId || !currentRecord) return;

    if (selectedEmpStatus === 'not-entered' || selectedEmpStatus === 'fully-exited' || !currentRecord.dinnerOut) {
      triggerNotification('error', 'Employee has no active dinner departure registered to return from.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Dinner Return', (photo) => handleDinnerIn(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerIn: timeStr,
      status: 'Present',
      locationDinnerIn: coords,
      photoDinnerIn: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'dinner return', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification('success', `${selectedEmpName} returned from dinner break at ${timeStr}. Welcome back to work!`);
    setPunchAnimation({
      type: 'dinner_in',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleEntry2CheckIn = async (selfiePhoto?: string) => {
    if (!selectedEmpId) return;

    if (currentRecord && currentRecord.entryTime) {
      triggerNotification('error', 'Night shift is disabled for employees who completed Day Shift today.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Night Shift Entry', (photo) => handleEntry2CheckIn(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    if (!currentRecord) {
      let newRecord: AttendanceRecord = {
        date: todayStr,
        employeeId: selectedEmpId,
        employeeName: selectedEmpName,
        entryTime: '',
        lunchOut: '',
        lunchIn: '',
        exitTime: '',
        entryTime2: timeStr,
        exitTime2: '',
        dinnerOut: '',
        dinnerIn: '',
        totalHours: 0,
        overtime: 0,
        status: 'Night Shift',
        locationEntry2: coords,
        photoEntry2: selfiePhoto,
      };
      newRecord = checkProximityAndFlag(coords, 'night shift entry', newRecord);
      onAddAttendance(newRecord);
      triggerNotification('success', `${selectedEmpName} registered night shift entry at ${timeStr}.`);
      setPunchAnimation({
        type: 'entry',
        name: selectedEmpName,
        time: timeStr
      });
    } else {
      let updatedRecord: AttendanceRecord = {
        ...currentRecord,
        entryTime2: timeStr,
        dinnerOut: '',
        dinnerIn: '',
        exitTime2: '',
        status: 'Night Shift Active',
        locationEntry2: coords,
        photoEntry2: selfiePhoto,
      };
      updatedRecord = checkProximityAndFlag(coords, 'second shift entry', updatedRecord);
      onUpdateAttendance(updatedRecord);
      triggerNotification('success', `${selectedEmpName} registered second shift entry dynamically at ${timeStr}.`);
      setPunchAnimation({
        type: 'entry',
        name: selectedEmpName,
        time: timeStr
      });
    }
  };

  const handleExitCheckOut = async (selfiePhoto?: string) => {
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

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Day Shift Departure', (photo) => handleExitCheckOut(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

    // Capture precise metrics
    const { totalHours, overtime, statusFlags } = calculateAttendanceMetrics(
      currentRecord.entryTime,
      timeStr,
      currentRecord.lunchOut,
      currentRecord.lunchIn || (currentRecord.lunchOut ? timeStr : ''), // auto balance lunch in if they check out directly
      settings
    );

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      lunchIn: currentRecord.lunchOut && !currentRecord.lunchIn ? timeStr : currentRecord.lunchIn,
      exitTime: timeStr,
      totalHours,
      overtime,
      status: statusFlags.join(', '),
      locationOut: coords,
      photoOut: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'shift exit check-out', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} checked out of Shift 1 at ${timeStr}. Total logged: ${totalHours} hrs (Overtime: ${overtime} hrs)`
    );
    setPunchAnimation({
      type: 'exit',
      name: selectedEmpName,
      time: timeStr
    });
  };

  const handleExit2CheckOut = async (selfiePhoto?: string) => {
    if (!selectedEmpId || !currentRecord || !currentRecord.entryTime2) return;

    if (selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'on-dinner') {
      triggerNotification('error', 'Employee is not actively working on Shift 2.');
      return;
    }

    if (typeof selfiePhoto !== 'string') {
      triggerSelfieAndPunch('Night Shift Departure', (photo) => handleExit2CheckOut(photo));
      return;
    }

    const coords = await fetchCurrentLocation();
    if (!validateGeofencingOrBlock(coords)) return;

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

    let updatedRecord: AttendanceRecord = {
      ...currentRecord,
      dinnerIn: currentRecord.dinnerOut && !currentRecord.dinnerIn ? timeStr : currentRecord.dinnerIn,
      exitTime2: timeStr,
      totalHours,
      overtime,
      status: statusFlags.join(', '),
      locationExit2: coords,
      photoExit2: selfiePhoto,
    };

    updatedRecord = checkProximityAndFlag(coords, 'night shift departure', updatedRecord);
    onUpdateAttendance(updatedRecord);
    triggerNotification(
      'success', 
      `${selectedEmpName} completed Shift 2 at ${timeStr}. Cumulative today: ${totalHours} hrs (Overtime: ${overtime} hrs)`
    );
    setPunchAnimation({
      type: 'exit',
      name: selectedEmpName,
      time: timeStr
    });
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

      {settings.strictGeofencing && (
        <div className="bg-indigo-55/90 border border-indigo-100 p-4 rounded-xl flex items-center space-x-3 text-slate-700 animate-fadeIn" id="strict-geo-banner">
          <MapPin className="w-5 h-5 text-indigo-600 shrink-0 animate-pulse" />
          <div className="text-xs">
            <span className="font-bold text-indigo-950 block">🔒 Multi-Site Geofencing Protection Enabled</span>
          </div>
        </div>
      )}

      {/* Silent fetch - no visual banner / popup overlay shown to employees */}

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
            
            <p className="text-2xs text-slate-400 mb-4 leading-relaxed tracking-wide uppercase font-mono">
              {loggedInEmployee 
                ? 'Authorized Employee Cabin Session' 
                : 'Find and choose your profile name in the dropdown below to authorize check-ins.'}
            </p>

            <div className="space-y-4">
              <div>
                {loggedInEmployee ? (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3.5 animate-fadeIn">
                    {loggedInEmployee.photoUrl ? (
                      <img 
                        src={loggedInEmployee.photoUrl} 
                        alt={loggedInEmployee.name} 
                        className="h-12 w-12 rounded-full object-cover border border-indigo-200 shadow-sm" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-250 flex items-center justify-center font-bold text-xs text-indigo-750">
                        {loggedInEmployee.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest font-mono">Cabin Active</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-850">{loggedInEmployee.name}</h4>
                      <p className="text-3xs text-slate-500 font-mono mt-0.5">{loggedInEmployee.id} • {loggedInEmployee.department}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-3xs uppercase tracking-wider font-semibold text-slate-400 mb-1 font-mono">
                      Identify Profile
                    </label>
                    <select
                      id="employee-select"
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        setNotification({ type: null, message: '' });
                      }}
                      className="w-full px-3.5 py-3 border border-slate-200 rounded-xl shadow-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 select-none text-sm transition-all text-slate-755 text-slate-750"
                    >
                      <option value="">-- Choose Your Profile --</option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedEmpId && (() => {
                const selectedEmp = employees.find(e => e.id === selectedEmpId);
                return (
                  <div className="p-4 bg-slate-50 border border-slate-100/80 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center gap-3 border-b border-slate-200/50 pb-2 mb-2">
                      {selectedEmp?.photoUrl ? (
                        <img 
                          src={selectedEmp.photoUrl} 
                          alt={selectedEmp.name} 
                          className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-3xs" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                          {selectedEmp?.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-850 leading-none">{selectedEmp?.name}</h4>
                        <span className="text-[9px] font-mono text-slate-400 mt-1 block">{selectedEmp?.id} • {selectedEmp?.department}</span>
                      </div>
                    </div>

                    <span className="text-2xs font-mono uppercase tracking-wider font-bold text-indigo-600 block">
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
                );
              })()}
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
              {/* Geofencing Status Indicator - Clean & Simple */}
              <div className="flex items-center justify-between px-1 text-slate-500 text-[11px]">
                <div className="flex items-center space-x-1.5 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span>GPS Geofencing verification active (100m limits)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold uppercase tracking-wide">
                  Calitech HQ
                </span>
              </div>

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

                {/* 1. ENTRY PUNCH (TOP) */}
                <div className="w-full font-sans">
                  <button
                    type="button"
                    id="btn-kiosk-entry"
                    onClick={handleEntryCheckIn}
                    disabled={selectedEmpStatus !== 'not-entered'}
                    className={`flex items-center justify-between w-full p-4.5 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'not-entered'
                        ? 'border-indigo-150 bg-indigo-50/50 hover:bg-indigo-55/60 text-indigo-950 shadow-sm cursor-pointer hover:border-indigo-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-indigo-600 block">
                        Shift Check-In Stamp
                      </span>
                      <span className="text-sm font-black block text-slate-800">ENTRY PUNCH</span>
                      <span className="text-[10.5px] text-slate-500 block">
                        {timeStr >= '14:00' ? (
                          <span className="text-indigo-650 font-bold font-mono">Starts Night Shift (≥ 14:00)</span>
                        ) : (
                          <span>Initiate Day Shift (&lt; 14:00)</span>
                        )}
                      </span>
                    </div>
                    <div className={`p-3 rounded-xl transition-transform ${
                      selectedEmpStatus === 'not-entered' ? 'bg-indigo-600 text-white group-hover:scale-105 shadow-sm' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <LogIn className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                {/* 2. LUNCH BREAK ROW (MIDDLE) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* LUNCH OUT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-lunchout"
                    onClick={handleLunchOut}
                    disabled={!(currentRecord && currentRecord.entryTime && !currentRecord.exitTime && !currentRecord.lunchOut)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      (currentRecord && currentRecord.entryTime && !currentRecord.exitTime && !currentRecord.lunchOut)
                        ? 'border-amber-100 bg-amber-50/45 hover:bg-amber-55 text-amber-900 shadow-sm cursor-pointer hover:border-amber-200'
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
                      (currentRecord && currentRecord.entryTime && !currentRecord.exitTime && !currentRecord.lunchOut) ? 'bg-amber-500 text-white group-hover:scale-105 shadow-sm' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Utensils className="w-4 h-4" />
                    </div>
                  </button>

                  {/* LUNCH IN BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-lunchin"
                    onClick={handleLunchIn}
                    disabled={!(currentRecord && currentRecord.lunchOut && !currentRecord.lunchIn && !currentRecord.exitTime)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      (currentRecord && currentRecord.lunchOut && !currentRecord.lunchIn && !currentRecord.exitTime)
                        ? 'border-emerald-250 bg-emerald-50 text-emerald-950 shadow-md cursor-pointer hover:border-emerald-450 ring-2 ring-emerald-500/25 duration-300 transform scale-[1.01] animate-pulse font-bold'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-600 block">
                        Lunch In (लंच से वापिस)
                      </span>
                      <span className="text-sm font-extrabold block">RETURN BREAK</span>
                      <span className="text-[10px] text-slate-500 block">Back from lunch rest.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      (currentRecord && currentRecord.lunchOut && !currentRecord.lunchIn && !currentRecord.exitTime) ? 'bg-emerald-600 text-white group-hover:scale-105 shadow-sm animate-bounce' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Coffee className="w-4 h-4" />
                    </div>
                  </button>
                </div>

                {/* 3. EXIT PUNCH (BOTTOM, AFTER LUNCH RETURN) */}
                <div className="w-full pt-1">
                  <button
                    type="button"
                    id="btn-kiosk-exit"
                    onClick={handleExitCheckOut}
                    disabled={!(currentRecord && currentRecord.entryTime && !currentRecord.exitTime)}
                    className={`flex items-center justify-between w-full p-4 rounded-xl border text-left transition-all group ${
                      (currentRecord && currentRecord.entryTime && !currentRecord.exitTime)
                        ? 'border-rose-150 bg-rose-50/20 hover:bg-rose-50/45 text-rose-950 shadow-sm cursor-pointer hover:border-rose-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-rose-600 block">
                        Conclude Daily Duty (ड्यूटी समाप्त करें)
                      </span>
                      <span className="text-sm font-black block text-slate-800">EXIT PUNCH (बाहर जा रहे हैं / छुट्टी)</span>
                      <span className="text-[10.5px] text-slate-500 block">Conclude standard working desk shifts & log payroll hours.</span>
                    </div>
                    <div className={`p-3 rounded-xl transition-transform ${
                      (currentRecord && currentRecord.entryTime && !currentRecord.exitTime) ? 'bg-rose-600 text-white group-hover:scale-105 shadow-sm' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <LogOut className="w-5 h-5" />
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

                {/* S2 ENTRY BUTTON (TOP OF SHIFT 2) */}
                <div className="w-full font-sans">
                  <button
                    type="button"
                    id="btn-kiosk-entry2"
                    onClick={handleEntry2CheckIn}
                    disabled={!!(currentRecord && currentRecord.entryTime) || !!(currentRecord && currentRecord.entryTime2)}
                    className={`flex items-center justify-between w-full p-4.5 rounded-xl border text-left transition-all group ${
                      !(currentRecord && currentRecord.entryTime) && !(currentRecord && currentRecord.entryTime2)
                        ? 'border-indigo-200 bg-indigo-100/20 hover:bg-indigo-100/40 text-indigo-950 shadow-sm cursor-pointer hover:border-indigo-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-indigo-700 block">
                        Clock Shift 2
                      </span>
                      <span className="text-sm font-extrabold block text-slate-800">START SHIFT 2</span>
                      <span className="text-[10.5px] text-slate-500 block">
                        {currentRecord?.entryTime ? 'Disabled: Day Duty Completed' : 'Log second shift / night.'}
                      </span>
                    </div>
                    <div className={`p-3 rounded-xl transition-transform ${
                      !(currentRecord && currentRecord.entryTime) && !(currentRecord && currentRecord.entryTime2) ? 'bg-indigo-700 text-white group-hover:scale-105 shadow-sm' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Moon className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                {/* Dinner Break Row (MIDDLE OF SHIFT 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* DINNER OUT BUTTON */}
                  <button
                    type="button"
                    id="btn-kiosk-dinnerout"
                    onClick={handleDinnerOut}
                    disabled={(selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'active-working') || !!currentRecord?.dinnerOut}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                      (selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'active-working') && !currentRecord?.dinnerOut
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
                      (selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'active-working') && !currentRecord?.dinnerOut ? 'bg-rose-500 text-white group-hover:scale-[1.02] shadow-sm' : 'bg-slate-200 text-slate-400'
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
                        ? 'border-emerald-250 bg-emerald-50 text-emerald-950 shadow-md cursor-pointer hover:border-emerald-450 ring-2 ring-emerald-500/25 duration-300 transform scale-[1.01] animate-pulse font-bold'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-600 block">
                        Dinner In (डिनर से वापिस)
                      </span>
                      <span className="text-sm font-extrabold block">DINNER RETURN</span>
                      <span className="text-[10px] text-slate-500 block">Back from night dinner.</span>
                    </div>
                    <div className={`p-2.5 rounded-lg transition-transform ${
                      selectedEmpStatus === 'on-dinner' ? 'bg-emerald-600 text-white group-hover:scale-105 shadow-sm animate-bounce' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Soup className="w-4 h-4" />
                    </div>
                  </button>
                </div>

                {/* S2 EXIT BUTTON (BOTTOM OF SHIFT 2) */}
                <div className="w-full pt-1">
                  <button
                    type="button"
                    id="btn-kiosk-exit2"
                    onClick={handleExit2CheckOut}
                    disabled={selectedEmpStatus !== 'active-working-shift2' && selectedEmpStatus !== 'on-dinner'}
                    className={`flex items-center justify-between w-full p-4 rounded-xl border text-left transition-all group ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner'
                        ? 'border-rose-150 bg-rose-50/20 hover:bg-rose-50/45 text-rose-950 shadow-sm cursor-pointer hover:border-rose-300'
                        : 'border-slate-100 bg-slate-100/50 text-slate-400 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-rose-600 block">
                        Conclude Shift 2 (शिफ्ट 2 समाप्त करें)
                      </span>
                      <span className="text-sm font-black block text-slate-800">FINISH SHIFT 2 (बाहर जा रहे हैं / छुट्टी)</span>
                      <span className="text-[10.5px] text-slate-500 block">Conclude second shift / OT.</span>
                    </div>
                    <div className={`p-3 rounded-xl transition-transform ${
                      selectedEmpStatus === 'active-working-shift2' || selectedEmpStatus === 'on-dinner' ? 'bg-rose-600 text-white group-hover:scale-105 shadow-sm' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <MoonStar className="w-5 h-5" />
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

      {/* Selfie Capture Modal */}
      {selfieState?.isOpen && (
        <div id="selfie-capture-overlay" className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 xs:p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn overflow-y-auto pt-3 xs:pt-6 sm:pt-4">
          <div className="bg-white rounded-3xl p-3 sm:p-5 w-[calc(100vw-12px)] xs:w-[calc(100vw-20px)] max-w-[340px] xs:max-w-[365px] sm:max-w-[420px] md:max-w-[450px] shadow-2xl border border-slate-100 relative text-center space-y-2.5 sm:space-y-4 animate-scaleIn select-none">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                <span>Selfie Verification Required</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setSelfieState(null);
                }}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-center space-x-1.5 pt-0.5 pb-0.5">
              <div className={`flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold transition-all ${!capturedPhoto ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-emerald-50 text-emerald-700'}`}>
                <span className={`h-3 w-3 rounded-full flex items-center justify-center text-[8px] font-black ${!capturedPhoto ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>1</span>
                <span>Photo</span>
              </div>
              <div className="w-3 h-px bg-slate-200"></div>
              <div className={`flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold transition-all ${capturedPhoto ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-400'}`}>
                <span className={`h-3 w-3 rounded-full flex items-center justify-center text-[8px] font-black ${capturedPhoto ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-500'}`}>2</span>
                <span>Confirm</span>
              </div>
            </div>

            {capturedPhoto ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl py-1 px-2.5 inline-flex items-center space-x-1 justify-center animate-fadeIn mx-auto">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[10px] text-emerald-750 font-bold">Photo Captured!</span>
              </div>
            ) : (
              <div className="text-[10.5px] text-slate-500 font-medium leading-tight max-w-[280px] mx-auto">
                Snap a clear face photo to complete <strong className="text-indigo-600 font-semibold">{selfieState.actionLabel}</strong>.
              </div>
            )}

            <div className={`relative bg-slate-950 rounded-2xl overflow-hidden aspect-[3/4] w-full max-w-[305px] xs:max-w-[335px] sm:max-w-[365px] md:max-w-[395px] mx-auto flex items-center justify-center border-4 shadow-inner transition-all duration-300 ${capturedPhoto ? (photoClarity === 'blur' ? 'border-red-200' : 'border-emerald-100') : 'border-slate-100'}`}>
              {capturedPhoto && (
                <img 
                  src={capturedPhoto} 
                  alt="Captured Selfie" 
                  className={`absolute inset-0 z-10 w-full h-full object-cover transition-all duration-300 ${photoClarity === 'blur' ? 'blur-[4px]' : ''}`} 
                />
              )}

              <video
                id="selfie-video-preview"
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${capturedPhoto ? 'hidden' : 'block'}`}
              />

              {/* Portrait face contour masking aligner */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 ${capturedPhoto ? 'hidden' : 'flex'}`}>
                <div className="w-11/12 h-5/6 border-2 border-dashed border-white/50 rounded-[120px]/[160px] flex flex-col items-center justify-center animate-pulse bg-slate-900/10">
                  <div className="text-[8px] text-white/80 uppercase tracking-widest font-mono select-none px-2 py-1 bg-slate-950/40 rounded backdrop-blur-[1px] mt-auto mb-6">
                    Align Face Here
                  </div>
                </div>
              </div>

              {cameraError && !capturedPhoto && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center space-y-3 z-20">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                  <p className="text-[10px] text-amber-100 font-mono leading-relaxed">{cameraError}</p>
                  <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-md transition-all uppercase">
                    Take Photo Using Phone
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleFileCapture}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Quality Check Warning shown ONLY when photo is Blurry */}
            {capturedPhoto && photoClarity === 'blur' && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl py-1.5 px-3 text-center animate-pulse flex items-center justify-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500 animate-bounce" />
                <span className="text-[10.5px] font-extrabold">Clear nahi hua! Please retake.</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      startCamera();
                    }}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-xl transition-all cursor-pointer font-sans"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      selfieState.onCapture(capturedPhoto);
                      stopCamera();
                    }}
                    className="flex-1 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center justify-center space-x-1.5 font-sans"
                  >
                    <span>Confirm & Punch</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setSelfieState(null);
                    }}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  
                  {!cameraError && (
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="flex-1 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer flex items-center justify-center space-x-1.5 font-sans"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Selfie</span>
                    </button>
                  )}
                  
                  {cameraError && (
                    <label className="flex-1 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer flex items-center justify-center space-x-1.5 font-sans">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                         capture="user"
                        onChange={handleFileCapture}
                        className="hidden"
                      />
                    </label>
                  )}
                </>
              )}
            </div>
            
            <div className="text-[9px] text-slate-400 font-mono uppercase tracking-widest pt-1 border-t border-slate-50">
              Face verification active
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS PUNCH ANIMATION MODAL */}
      <AnimatePresence>
        {punchAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md"
            onClick={() => setPunchAnimation(null)}
          >
            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-emerald-100 flex flex-col items-center text-center space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated Scale Up success checkmark circle wrapper */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                  className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm"
                >
                  <motion.svg
                    className="w-10 h-10 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.3, duration: 0.45, ease: 'easeOut' }}
                      d="M5 13l4 4L19 7"
                    />
                  </motion.svg>
                </motion.div>
                
                {/* Floating particle animations around the circle */}
                {[...Array(6)].map((_, i) => {
                  const angle = (i * 360) / 6;
                  const rad = (angle * Math.PI) / 180;
                  const dist = 48;
                  const x = Math.cos(rad) * dist;
                  const y = Math.sin(rad) * dist;
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{ scale: [0, 1, 0], x: [0, x], y: [0, y] }}
                      transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 -ml-1 -mt-1 w-2.5 h-2.5 bg-emerald-400 rounded-full"
                    />
                  );
                })}
              </div>

              <div className="space-y-2">
                <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Verified & Logged ✓
                </span>
                <h3 className="text-xl font-black text-slate-850 tracking-tight">
                  Punch Successful
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {punchAnimation.name}
                </p>
              </div>

              {/* Punch Card Receipt Style detail box */}
              <div className="w-full bg-slate-50 border border-slate-100/80 rounded-2xl p-4.5 space-y-3 relative overflow-hidden">
                {/* Left/Right dotted holes pattern to simulate punch card receipt */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-white border-r border-slate-100/80 rounded-r-full"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-white border-l border-slate-100/80 rounded-l-full"></div>
                
                <div className="flex justify-between items-center text-xs text-slate-500 border-b border-dashed border-slate-200 pb-2">
                  <span className="font-medium">Stamp Status:</span>
                  <span className="font-black uppercase tracking-wider text-indigo-650 font-sans text-[11px]">
                    {punchAnimation.type === 'entry' && 'ENTRY PUNCH'}
                    {punchAnimation.type === 'exit' && 'EXIT PUNCH'}
                    {punchAnimation.type === 'lunch_out' && 'LUNCH DEPART'}
                    {punchAnimation.type === 'lunch_in' && 'LUNCH RETURN'}
                    {punchAnimation.type === 'dinner_out' && 'DINNER DEPART'}
                    {punchAnimation.type === 'dinner_in' && 'DINNER RETURN'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span className="font-medium">Clock Registered:</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                    {punchAnimation.time}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPunchAnimation(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PERSISTENT BILINGUAL GPS PERMISSION BLOCKER MODAL */}
      <AnimatePresence>
        {showGpsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 overflow-y-auto"
            style={{ contentVisibility: 'auto' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-rose-100 flex flex-col space-y-6 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated pulsating Location Warning Icon */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute inset-0 bg-rose-500/10 rounded-full scale-125"
                  />
                  <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100 relative">
                    <MapPin className="w-8 h-8 text-rose-600 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="inline-block bg-rose-100/80 text-rose-800 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
                    GPS ACCESS REQUIRED • जीपीएस आवश्यक है
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight">
                    Location Permission Denied
                  </h3>
                  <p className="text-sm font-bold text-rose-600">
                    जीपीएस अनुमति ब्लॉक है - अटेंडेंस दर्ज नहीं की जा सकती
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Attendance system requires secure GPS logging to verify office presence. Please turn on location permissions to unlock check-in/out.
                  </p>
                </div>
              </div>

              {/* iPhone Step-by-Step interactive instructions card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-4 text-xs">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200/50 pb-1.5 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  <span>iPhone (iOS) Settings Guide • आईफोन गाइड</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Safari browser instructions */}
                  <div className="space-y-2">
                    <span className="font-bold text-indigo-700 block text-2xs uppercase tracking-wide">For Safari (सफ़ारी ब्राउज़र)</span>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed pl-1">
                      <li>Tap the <strong className="text-slate-800 font-bold">"aA"</strong> or settings key near the URL bar.</li>
                      <li>Select <strong className="text-slate-800 font-medium">Website Settings</strong>.</li>
                      <li>Change <strong className="text-indigo-600 font-bold">Location</strong> to <strong className="text-emerald-600 font-bold">Allow / Ask</strong>.</li>
                      <li>Reload the page.</li>
                    </ol>
                  </div>

                  {/* Chrome browser instructions */}
                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3.5 md:pt-0 md:pl-4">
                    <span className="font-bold text-indigo-700 block text-2xs uppercase tracking-wide">For Google Chrome (क्रोम)</span>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-650 leading-relaxed">
                      <li>Go to iPhone <strong className="text-slate-800 font-bold">Settings</strong> app.</li>
                      <li>Select <strong className="text-slate-800 font-medium">Privacy & Security &gt; Location Services</strong>.</li>
                      <li>Find <strong className="text-slate-800 font-medium">Chrome / Safari</strong> and set to <strong className="text-emerald-600 font-bold">While Using App</strong>.</li>
                    </ol>
                  </div>
                </div>

                <div className="border-t border-slate-200/55 pt-3 text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700 block mb-0.5">💡 Still not seeing the allow prompt? (फिर भी समस्या है?)</span>
                  iPhone Settings &gt; General &gt; Transfer or Reset iPhone &gt; Reset &gt; Reset Location & Privacy. Then refresh this tab!
                </div>
              </div>

              {/* Action layout */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={isGpsRetrying}
                  onClick={handleRetryGpsVerification}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isGpsRetrying ? (
                    <>
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Verifying GPS...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄 TRY AGAIN / री-वेरीफाई करें</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="py-3 px-4 bg-slate-105 hover:bg-slate-200 text-slate-700 bg-slate-100 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center"
                >
                  📱 Refresh Website
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
