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
  selectedWorkLocation?: string
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

  // Check late arrival on morning (from 10:00 AM)
  const checkInTime = s1Entry || s2Entry;
  const hasMorningLateEntry = checkInTime ? timeToMinutes(checkInTime) > timeToMinutes("10:00") : false;

  // Check early checkout (before 17:00 / 5 PM)
  const finalCheckOutTime = s2Entry ? s2Exit : s1Exit;
  const hasEarlyExitHalfDay = finalCheckOutTime ? timeToMinutes(finalCheckOutTime) < timeToMinutes("17:00") : false;

  // Check standard late entry based on settings for informational flag
  if (s1Entry && settings.workStartHour && isTimeAfter(s1Entry, settings.workStartHour)) {
    statusFlags.push('Late Entry');
  }

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
      dinnerMins = settings.lunchDurationMinutes || 60; // fallback to same default break mins
    }
  }

  let totalDeductions = lunchMins + dinnerMins;
  let netMins = totalGrossMins - totalDeductions;
  if (netMins < 0) netMins = 0;

  let totalHours = minutesToDecimalHours(netMins);

  let isHalfDay = false;
  let isAbsent = false;

  const isFixedShift = !!(selectedWorkLocation && (
    (settings?.fixedShiftLocations?.some(loc => loc.trim().toLowerCase() === selectedWorkLocation.trim().toLowerCase())) || 
    (selectedWorkLocation.trim().toLowerCase() === 'hetero changsari')
  ));

  if (isFixedShift) {
    // Special Client Site Visit rule - credit exactly 1 Full Day Shift (8 hours)
    totalHours = settings.standardHours || 8;
    isHalfDay = false;
    isAbsent = false;
  } else {
    // Evaluate new rules
    if (!isCurrentlyActive) {
      // Fully checked out or absent
      if (totalHours < 3) {
        isAbsent = true;
      } else {
        // Standard late morning arrival (Shift 1 check-in > 10:00 AM)
        const morningLate = s1Entry ? (timeToMinutes(s1Entry) > timeToMinutes("10:00")) : false;
        
        // Standard early check-out (Final exit < 17:00 / 5 PM)
        const lastExit = s2Exit || s1Exit;
        const earlyExit = lastExit ? (timeToMinutes(lastExit) < timeToMinutes("17:00")) : false;
        
        if (morningLate || earlyExit) {
          isHalfDay = true;
        } else if (totalHours < (settings.standardHours || 8)) {
          // Not standard late (>10:00) and not early (<17:00).
          // Let's check if they completed a full-day span:
          // Did they check in by 10:00 AM AND stay at least until 17:00 PM?
          const hasFullDaySpan = (s1Entry && timeToMinutes(s1Entry) <= timeToMinutes("10:00")) &&
                                 (lastExit && timeToMinutes(lastExit) >= timeToMinutes("17:00"));
          if (hasFullDaySpan) {
            isHalfDay = false; // It's a FULL DAY (Present) as they worked the whole required duration!
          } else {
            isHalfDay = true;
          }
        }
      }
    } else {
      // Informational: mark as Half Day immediately if their Shift 1 check-in was late (after 10:00 AM)
      const morningLate = s1Entry ? (timeToMinutes(s1Entry) > timeToMinutes("10:00")) : false;
      if (morningLate) {
        isHalfDay = true;
      }
    }
  }

  let overtime = 0;

  if (isAbsent) {
    totalHours = 0;
    overtime = 0;
    statusFlags.push('Absent');
  } else {
    if (isFixedShift) {
      statusFlags.push('Present');
      overtime = 0; // Excluded by default
    } else if (isHalfDay) {
      statusFlags.push('Half Day');
      // "agar employ 3 hour se jiyada duty kore tho hour wage ke hisab se over time add hona cahiye"
      // Half Day standard is 3 hours; any worked hours above 3 are overtime
      overtime = totalHours > 3 ? Math.round((totalHours - 3) * 100) / 100 : 0;
    } else {
      statusFlags.push('Present');
      const standardHours = settings.standardHours || 8;
      overtime = totalHours > standardHours ? Math.round((totalHours - standardHours) * 100) / 100 : 0;
    }
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

  // Ensure status flags doesn't duplicate 'Present' when there is '2nd Shift' or 'Half Day'
  if (cleanedFlags.includes('2nd Shift') || cleanedFlags.includes('Half Day')) {
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
    name: "Calitech Engineering Solutions Pvt. Ltd.",
    radiusMeters: 500
  },
  {
    lat: 26.1158,
    lng: 91.4932,
    name: "Ajanta Pharma, Guwahati",
    radiusMeters: 200
  },
  {
    lat: 26.1030,
    lng: 91.5173,
    name: "Natco Pharma, Guwahati",
    radiusMeters: 200
  },
  {
    lat: 26.1124,
    lng: 91.4880,
    name: "Hetero Pharma, Guwahati, Hudumpur",
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
  status: 'Present' | 'Absent' | 'Weekly Off' | 'Late Entry' | 'Night Shift' | 'On Leave' | 'Pending' | 'Future';
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
  employee: { id: string; hourlyRate: number; monthlySalary?: number },
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

