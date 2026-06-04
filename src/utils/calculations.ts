import { Settings } from '../types';

/**
 * Formats a Date object as local YYYY-MM-DD to avoid UTC timezone mismatches
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a YYYY-MM-DD date string nicely to Date Month Year (DD-MM-YYYY) format.
 * E.g., "2026-05-30" becomes "30-05-2026"
 */
export const formatDateDMY = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year.length === 4) {
      return `${day}-${month}-${year}`;
    }
  }
  return dateStr;
};

/**
 * Converts "HH:MM" (or "HH:MM AM/PM") string to minutes from start of day.
 * Robustly parses both 24-hour and 12-hour AM/PM formats.
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  // Clean, trim and convert to lowercase
  const cleanStr = timeStr.trim().toLowerCase();
  
  // Check for AM/PM indicators
  const isPm = cleanStr.includes('pm');
  const isAm = cleanStr.includes('am');
  
  // Extract numbers only
  const timeOnly = cleanStr.replace(/[a-z\s]/g, '');
  const parts = timeOnly.split(':').map(Number);
  
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  
  let hours = parts[0];
  const minutes = parts[1];
  
  if (isPm && hours < 12) {
    hours += 12;
  } else if (isAm && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
};

/**
 * Converts minutes to hours in decimal format (e.g., 510 mins -> 8.5 hours)
 */
export const minutesToDecimalHours = (mins: number): number => {
  return Math.round((mins / 60) * 100) / 100;
};

/**
 * Adds minutes to an HH:MM format time string and returns the new HH:MM string.
 */
export const addMinutesToTimeStr = (timeStr: string, minsToAdd: number): string => {
  if (!timeStr || !isValidTimeStr(timeStr)) return '';
  const totalMins = (timeToMinutes(timeStr) + minsToAdd) % 1440;
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const m = (totalMins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Checks if a time is after a reference time
 */
export const isTimeAfter = (timeStr: string, refStr: string): boolean => {
  return timeToMinutes(timeStr) > timeToMinutes(refStr);
};

/**
 * Checks if a time is before a reference time
 */
export const isTimeBefore = (timeStr: string, refStr: string): boolean => {
  return timeToMinutes(timeStr) < timeToMinutes(refStr);
};

/**
 * Checks if a time string is valid and not a placeholder like "--:--" or "null" / "undefined".
 */
export const isValidTimeStr = (timeStr: string | undefined | null): boolean => {
  if (!timeStr) return false;
  const clean = timeStr.trim();
  if (clean === '' || clean === '--:--' || clean.toLowerCase() === 'undefined' || clean.toLowerCase() === 'null') {
    return false;
  }
  return true;
};

/**
 * Helper interface for Shift Timings Configuration
 */
interface ShiftConfig {
  name: string;
  start: string;
  end: string;
  graceIn: string;
  minOut: string;
}

/**
 * Returns configuration for a designated shift name.
 */
export const getShiftConfig = (shiftName?: string): ShiftConfig => {
  const name = shiftName?.trim() || 'General Shift';
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('a shift') || nameLower === 'a') {
    return {
      name: 'A Shift',
      start: '07:00',
      end: '15:00',
      graceIn: '07:45',
      minOut: '14:00',
    };
  } else if (nameLower.includes('b shift') || nameLower === 'b') {
    return {
      name: 'B Shift',
      start: '14:00',
      end: '23:00',
      graceIn: '14:45',
      minOut: '22:00',
    };
  } else if (nameLower.includes('c shift') || nameLower.includes('night shift') || nameLower === 'c') {
    return {
      name: 'C Shift',
      start: '23:00',
      end: '07:00',
      graceIn: '23:45',
      minOut: '06:00',
    };
  } else {
    // Default is General Shift
    return {
      name: 'General Shift',
      start: '09:00',
      end: '18:00',
      graceIn: '09:45',
      minOut: '17:00',
    };
  }
};

/**
 * Automatically detects the shifting configuration based on first Entry (IN) punch time
 * - A Shift (07:00 - 15:00): Entry matches roughly if before 08:00 AM (e.g. 05:00 AM to 08:00 AM)
 * - General Shift (09:00 - 18:00): Entry matches from 08:01 AM to 11:30 AM
 * - B Shift (14:00 - 23:00): Entry matches from 11:31 AM to 06:00 PM
 * - C Shift (23:00 - 07:00): Entry matches from 06:01 PM to 04:59 AM
 */
export const detectShiftFromPunchTime = (timeStr?: string): string => {
  if (!timeStr || !isValidTimeStr(timeStr)) {
    return 'General Shift';
  }
  const mins = timeToMinutes(timeStr);
  
  if (mins >= 300 && mins <= 480) { // 05:00 AM to 08:00 AM
    return 'A Shift';
  } else if (mins > 480 && mins <= 690) { // 08:01 AM to 11:30 AM
    return 'General Shift';
  } else if (mins > 690 && mins <= 1080) { // 11:31 AM to 06:00 PM (18:00)
    return 'B Shift';
  } else { // 06:01 PM to 04:59 AM (1081 to 299 mins)
    return 'C Shift';
  }
};

/**
 * Computes difference in minutes from entry-start time, crossing midnight if applicable.
 */
export const minutesDiffFromStart = (timeStr: string, startStr: string): number => {
  let tMins = timeToMinutes(timeStr);
  let sMins = timeToMinutes(startStr);
  
  if (tMins - sMins < -720) {
    tMins += 1440;
  } else if (tMins - sMins > 720) {
    sMins += 1440;
  }
  return tMins - sMins;
};

/**
 * Computes difference in minutes from exit-end time, crossing midnight if applicable.
 */
export const minutesDiffFromEnd = (timeStr: string, endStr: string): number => {
  let tMins = timeToMinutes(timeStr);
  let eMins = timeToMinutes(endStr);
  
  if (tMins - eMins < -720) {
    tMins += 1440;
  } else if (tMins - eMins > 720) {
    eMins += 1440;
  }
  return tMins - eMins;
};

/**
 * Verifies if a location is eligible for Overtime (Hetero Palashbari, Hetero Changsari, Natco Pharma, Anajta Pharma)
 */
export const isLocationEligibleForOvertime = (locationName?: string): boolean => {
  if (!locationName) return false;
  const locLower = locationName.trim().toLowerCase();
  const eligibleTerms = [
    'hetero palashbari',
    'hetero changsari',
    'natco pharma',
    'anajta pharma',
    'ajanta pharma',
    'hetero pharma'
  ];
  return eligibleTerms.some(term => locLower.includes(term));
};

/**
 * Primary calculator for attendance metrics
 */
export const calculateAttendanceMetrics = (
  entry: string,
  exit: string,
  lunchOut: string,
  lunchIn: string,
  settings: Settings,
  entry2?: string,
  exit2?: string,
  dinnerOut?: string,
  dinnerIn?: string,
  selectedWorkLocation?: string,
  assignedShift?: string
): {
  totalHours: number;
  overtime: number;
  statusFlags: string[];
  lunchDurationMins: number;
  dinnerDurationMins?: number;
} => {
  const statusFlags: string[] = [];
  
  const s1Entry = entry && isValidTimeStr(entry) ? entry.trim() : '';
  const s1Exit = exit && isValidTimeStr(exit) ? exit.trim() : '';
  const s2Entry = entry2 && isValidTimeStr(entry2) ? entry2.trim() : '';
  const s2Exit = exit2 && isValidTimeStr(exit2) ? exit2.trim() : '';
  const lOut = lunchOut && isValidTimeStr(lunchOut) ? lunchOut.trim() : '';
  const lIn = lunchIn && isValidTimeStr(lunchIn) ? lunchIn.trim() : '';
  const dOut = dinnerOut && isValidTimeStr(dinnerOut) ? dinnerOut.trim() : '';
  const dIn = dinnerIn && isValidTimeStr(dinnerIn) ? dinnerIn.trim() : '';

  if (!s1Entry && !s2Entry) {
    return { totalHours: 0, overtime: 0, statusFlags: ['Absent'], lunchDurationMins: 0, dinnerDurationMins: 0 };
  }

  // Determine active states
  const isShift1Active = !!(s1Entry && !s1Exit);
  const isShift2Active = !!(s2Entry && !s2Exit);
  const isCurrentlyActive = isShift1Active || isShift2Active;

  let totalGrossMins = 0;
  let lunchMins = 0;
  let dinnerMins = 0;

  // --- SHIFT 1 WORKED TIME ---
  if (s1Entry) {
    const entryMins = timeToMinutes(s1Entry);
    const exitMins1 = s1Exit ? timeToMinutes(s1Exit) : 0;
    
    if (exitMins1 > 0) {
      if (exitMins1 < entryMins) {
        // Crossed midnight
        totalGrossMins += (24 * 60 - entryMins) + exitMins1;
      } else {
        totalGrossMins += exitMins1 - entryMins;
      }
    } else {
      // Shift 1 still active
      if (lOut && !lIn) {
        statusFlags.push('On Lunch');
      } else if (dOut && !dIn) {
        statusFlags.push('On Dinner');
      } else {
        statusFlags.push('Active');
      }
    }
  }

  // --- SHIFT 2 WORKED TIME (IF PRESENT) ---
  if (s2Entry) {
    if (s1Entry) {
      statusFlags.push('2nd Shift');
    }
    const entryMins2 = timeToMinutes(s2Entry);
    const exitMins2 = s2Exit ? timeToMinutes(s2Exit) : 0;

    if (exitMins2 > 0) {
      if (exitMins2 < entryMins2) {
        // Crossed midnight
        totalGrossMins += (24 * 60 - entryMins2) + exitMins2;
      } else {
        totalGrossMins += exitMins2 - entryMins2;
      }
    } else {
      // Shift 2 still active
      if (dOut && !dIn) {
        statusFlags.push('On Dinner');
      } else if (lOut && !lIn) {
        statusFlags.push('On Lunch');
      } else {
        statusFlags.push('Active (Shift 2)');
      }
    }
  }

  // Lunch break calculation
  if (lOut) {
    if (lIn) {
      const loMins = timeToMinutes(lOut);
      const liMins = timeToMinutes(lIn);
      if (liMins > loMins) {
        lunchMins = liMins - loMins;
      } else if (liMins < loMins) {
        lunchMins = (24 * 60 - loMins) + liMins;
      }
    } else {
      lunchMins = settings.lunchDurationMinutes || 60;
    }
    // Safety cap: If lunch duration is unreasonably long (e.g., > 120 mins), it's highly likely a forgotten punch-in.
    // Fall back to standard lunch break to protect employee's worked hours.
    if (lunchMins > 120) {
      lunchMins = settings.lunchDurationMinutes || 60;
    }
  }

  // Dinner break calculation
  if (dOut) {
    if (dIn) {
      const doMins = timeToMinutes(dOut);
      const diMins = timeToMinutes(dIn);
      if (diMins > doMins) {
        dinnerMins = diMins - doMins;
      } else if (diMins < doMins) {
        dinnerMins = (24 * 60 - doMins) + diMins;
      }
    } else {
      dinnerMins = settings.lunchDurationMinutes || 60;
    }
    // Safety cap: If dinner duration is unreasonably long (e.g., > 120 mins), it's highly likely a forgotten punch-in.
    // Fall back to standard break to protect employee's worked hours.
    if (dinnerMins > 120) {
      dinnerMins = settings.lunchDurationMinutes || 60;
    }
  }

  let totalDeductions = lunchMins + dinnerMins;
  let netMins = totalGrossMins - totalDeductions;
  if (netMins < 0) netMins = 0;

  let totalHours = minutesToDecimalHours(netMins);

  let isHalfDay = false;
  let isAbsent = false;

  const actualIn = s1Entry || s2Entry;
  const actualOut = s2Exit || s1Exit;

  // Retrieve active shift timings config automatically from assignedShift or fallback to punch-in time detection
  const detectedShift = assignedShift || (actualIn ? detectShiftFromPunchTime(actualIn) : 'General Shift');
  const shiftConfig = getShiftConfig(detectedShift);

  const inDiff = actualIn ? minutesDiffFromStart(actualIn, shiftConfig.start) : 0;
  const isLateCheckIn = actualIn && (inDiff > 45 || (settings.workStartHour && actualIn > settings.workStartHour));

  if (isLateCheckIn) {
    statusFlags.push('Late Entry');
  }

  if (!isCurrentlyActive) {
    // Both entries have been completed (fully checked out), check absent first
    if (totalHours < 3) {
      isAbsent = true;
    } else {
      // Analyze grace & early checkouts
      const outDiff = minutesDiffFromEnd(actualOut, shiftConfig.end);

      const inMeetsGrace = (inDiff <= 45);
      const outMeetsMinExit = (outDiff >= -60);

      if (inMeetsGrace && outMeetsMinExit) {
        isAbsent = false;
        isHalfDay = false;
      } else {
        isHalfDay = true;
      }
    }
  } else {
    // Session is still active on-going
    if (inDiff > 45) {
      isHalfDay = true;
    }
  }

  let overtime = 0;
  const eligibleForOT = isLocationEligibleForOvertime(selectedWorkLocation);

  if (!isAbsent && eligibleForOT && actualOut) {
    const extraMinutes = minutesDiffFromEnd(actualOut, shiftConfig.end);
    if (extraMinutes > 0) {
      // Completed hours only, minutes ignored: Floor(Total Extra Minutes ÷ 60)
      overtime = Math.floor(extraMinutes / 60);
    }
  }

  // Setup presence statuses
  if (isAbsent) {
    totalHours = 0;
    overtime = 0;
    statusFlags.push('Absent');
  } else if (isHalfDay) {
    statusFlags.push('Half Day');
  } else {
    statusFlags.push('Present');
  }

  // Active flag formatting and cleanup
  let cleanedFlags = Array.from(new Set(statusFlags));

  if (isAbsent) {
    cleanedFlags = ['Absent'];
  } else {
    cleanedFlags = cleanedFlags.filter(f => f !== 'Active' && f !== 'Active (Shift 2)');
    if (isCurrentlyActive) {
      if (isShift2Active) {
        cleanedFlags.push('Active (Shift 2)');
      } else {
        cleanedFlags.push('Active');
      }
    }
  }

  // Ensure status flags doesn't duplicate 'Present' when there is '2nd Shift' or 'Half Day' or 'Late Entry'
  if (cleanedFlags.includes('2nd Shift') || cleanedFlags.includes('Half Day') || cleanedFlags.includes('Late Entry')) {
    cleanedFlags = cleanedFlags.filter(f => f !== 'Present');
  }

  return {
    totalHours,
    overtime,
    statusFlags: cleanedFlags,
    lunchDurationMins: lunchMins,
    dinnerDurationMins: dinnerMins,
  };
};

/**
 * Evaluates earnings for an employee based on metrics
 */
export const calculateEarnings = (
  hoursWorked: number,
  overtimeHours: number,
  hourlyRate: number,
  multiplier: number = 1.5,
  isIncomplete: boolean = false,
  monthlySalary?: number,
  isHalfDay: boolean = false
): {
  regularPay: number;
  overtimePay: number;
  totalPay: number;
} => {
  if (isIncomplete || hoursWorked < 3) {
    return {
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
    };
  }

  let regularPay = 0;
  if (monthlySalary && monthlySalary > 0) {
    const dailyWage = monthlySalary / 30;
    if (isHalfDay) {
      regularPay = Math.round((dailyWage / 2) * 100) / 100;
    } else {
      regularPay = Math.round(dailyWage * 100) / 100;
    }
  } else {
    const standardWork = Math.max(0, hoursWorked - overtimeHours);
    regularPay = Math.round(standardWork * hourlyRate * 100) / 100;
  }

  const overtimePay = Math.round(overtimeHours * (hourlyRate * multiplier) * 100) / 100;
  const totalPay = Math.round((regularPay + overtimePay) * 100) / 100;

  return {
    regularPay,
    overtimePay,
    totalPay,
  };
};

export interface AllowedLocation {
  lat: number;
  lng: number;
  name: string;
  radiusMeters: number;
}

export const ALLOWED_LOCATIONS: AllowedLocation[] = [
  {
    lat: 26.1185573,
    lng: 91.5396016,
    name: "Calitech",
    radiusMeters: 500
  },
  {
    lat: 26.1158,
    lng: 91.4932,
    name: "Ajanta",
    radiusMeters: 200
  },
  {
    lat: 26.1030,
    lng: 91.5173,
    name: "Natco",
    radiusMeters: 200
  },
  {
    lat: 26.1124,
    lng: 91.4880,
    name: "Hetero Palashbari",
    radiusMeters: 200
  },
  {
    lat: 26.2570,
    lng: 91.6910,
    name: "Hetero Changsari",
    radiusMeters: 200
  }
];

export const OFFICE_COORDS = ALLOWED_LOCATIONS[0];

/**
 * Calculates distance between two latitude/longitude points in meters using Haversine formula
 */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

/**
 * Parses coordinate string (e.g., "26.1185573,91.5396016") and checks if it's within a specific radius of office coordinates
 */
export function verifyProximityToOffice(coordStr: string): {
  isWithinRange: boolean;
  distance: number;
  matchedLocationName: string;
} {
  if (!coordStr) {
    return { isWithinRange: false, distance: Infinity, matchedLocationName: "Unknown" };
  }
  const parts = coordStr.split(',').map(v => v.trim()).map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return { isWithinRange: false, distance: Infinity, matchedLocationName: "Unknown" };
  }
  const [lat, lng] = parts;

  let closestLocation = ALLOWED_LOCATIONS[0];
  let minDistance = Infinity;

  // Find the closest allowed site/office
  for (const loc of ALLOWED_LOCATIONS) {
    const dist = getDistanceInMeters(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestLocation = loc;
    }
  }

  // Radius enforcement bypassed entirely as requested to prevent false GPS blockages
  const isWithinRange = true;

  return {
    isWithinRange,
    distance: Math.round(minDistance),
    matchedLocationName: closestLocation.name
  };
}

export interface ProcessedDayLog {
  dateObj: Date;
  dateString: string;
  dayLabel: string;
  formattedDate: string;
  status: 'Present' | 'Absent' | 'Weekly Off' | 'Late Entry' | 'Night Shift' | 'On Leave' | 'Pending' | 'Future' | 'Half Day';
  isWeekend: boolean;
  clockIn: string;
  lunchOut: string;
  lunchIn: string;
  clockOut: string;
  hours: number;
  overtime: number;
  notes?: string;
  rawRecord?: any;
  extraSundayPay?: number;
  extraSundayHours?: number;
}

export function getProcessedLogsForEmployee(
  myLogs: { date: string; [key: string]: any }[],
  employee: { id: string; hourlyRate: number; monthlySalary?: number; assignedShift?: string },
  yearMonth: string,
  settings: Settings
): ProcessedDayLog[] {
  const [year, month] = yearMonth.split('-').map(Number);
  
  // 1. Generate all dates in the selected month
  const dateList: Date[] = [];
  const dateCursor = new Date(year, month - 1, 1);
  while (dateCursor.getMonth() === month - 1) {
    dateList.push(new Date(dateCursor));
    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  // 2. Map calendar dates to attendance status initially
  const logs: ProcessedDayLog[] = dateList.map(date => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const compareDate = new Date(date);
    compareDate.setHours(0,0,0,0);
    const compareToday = new Date();
    compareToday.setHours(0,0,0,0);
    const isFuture = compareDate > compareToday;
    const isToday = compareDate.getTime() === compareToday.getTime();
    
    // Find matching record
    const matchedRecord = myLogs.find(log => log.date === dateStr);
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0; // Weekly Off on Sunday (Sat is standard work day)

    let status: 'Present' | 'Absent' | 'Weekly Off' | 'Late Entry' | 'Night Shift' | 'On Leave' | 'Pending' | 'Future' | 'Half Day' = 'Absent';
    let detail = matchedRecord;

    if (isFuture) {
      status = 'Future';
    } else if (matchedRecord) {
      if (matchedRecord.status && matchedRecord.status.toLowerCase().includes('leave')) {
        status = 'On Leave';
      } else {
        const inTime = matchedRecord.entryTime || matchedRecord.entryTime2;
        const shiftConfig = getShiftConfig(employee.assignedShift || 'General Shift');
        const inDiff = inTime ? minutesDiffFromStart(inTime, shiftConfig.start) : 0;
        const isDynamicLate = inTime && inTime !== '--:--' && (inDiff > 45 || (settings.workStartHour && inTime > settings.workStartHour));
        
        if (matchedRecord.status && matchedRecord.status.toLowerCase().includes('half day')) {
          status = 'Half Day';
        } else if (matchedRecord.status && (matchedRecord.status === 'Late Entry' || matchedRecord.status.toLowerCase().includes('late') || isDynamicLate)) {
          status = 'Late Entry';
        } else if (matchedRecord.status === 'Night Shift') {
          status = 'Night Shift';
        } else {
          status = 'Present';
        }
      }
    } else if (isWeekend) {
      status = 'Weekly Off';
    } else if (isToday) {
      status = 'Pending';
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

  // 3. Group processed logs by week id to apply rules
  const getMondayDateString = (dt: Date): string => {
    const copy = new Date(dt);
    const day = copy.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diff = copy.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(copy.setDate(diff));
    const y = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const logsByWeek: { [weekId: string]: ProcessedDayLog[] } = {};
  logs.forEach(log => {
    const weekId = getMondayDateString(log.dateObj);
    if (!logsByWeek[weekId]) {
      logsByWeek[weekId] = [];
    }
    logsByWeek[weekId].push(log);
  });

  // 4. Process each week's Sunday / Weekly off rule
  Object.keys(logsByWeek).forEach(weekId => {
    const weekDays = logsByWeek[weekId];
    // Find Sunday of this week
    const sundayLog = weekDays.find(day => day.dateObj.getDay() === 0);
    if (sundayLog) {
      const workedOnSunday = sundayLog.hours > 0 || (sundayLog.rawRecord && (sundayLog.rawRecord.entryTime || sundayLog.rawRecord.entryTime2));
      if (workedOnSunday) {
        // Find if there are other days of this week that were missed (within this month)
        const otherDays = weekDays.filter(day => day.dateObj.getDay() !== 0);
        const missedDays = otherDays.filter(day => day.status === 'Absent' || day.status === 'On Leave' || day.status === 'Pending');
        
        if (missedDays.length > 0) {
          // Rule 1: Swap first missed day of this week to Weekly Off instead of Absent
          const firstMissed = missedDays[0];
          firstMissed.status = 'Weekly Off';
        } else {
          // Rule 2: Worked Sunday + No absent days in the rest of this week -> Sunday gets extra 8 hours (1 day) pay!
          const extraPay = employee.monthlySalary && employee.monthlySalary > 0 
            ? (employee.monthlySalary / 30) 
            : (8 * employee.hourlyRate);
          
          sundayLog.extraSundayPay = extraPay;
          sundayLog.extraSundayHours = 8;
        }
      }
    }
  });

  return logs;
}

