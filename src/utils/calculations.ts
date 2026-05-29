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
  dinnerIn?: string
): {
  totalHours: number;
  overtime: number;
  statusFlags: string[];
  lunchDurationMins: number;
  dinnerDurationMins?: number;
} => {
  const statusFlags: string[] = [];
  
  if (!entry && !entry2) {
    return { totalHours: 0, overtime: 0, statusFlags: ['Absent'], lunchDurationMins: 0, dinnerDurationMins: 0 };
  }

  // Determine active states
  const isShift1Active = entry && !exit;
  const isShift2Active = entry2 && !exit2;
  const isCurrentlyActive = isShift1Active || isShift2Active;

  // Check late arrival on morning (from 10:00 AM)
  const checkInTime = entry || entry2;
  const hasMorningLateEntry = checkInTime ? timeToMinutes(checkInTime) > timeToMinutes("10:00") : false;

  // Check early checkout (before 17:00 / 5 PM)
  const finalCheckOutTime = entry2 ? exit2 : exit;
  const hasEarlyExitHalfDay = finalCheckOutTime ? timeToMinutes(finalCheckOutTime) < timeToMinutes("17:00") : false;

  // Check standard late entry based on settings for informational flag
  if (entry && settings.workStartHour && isTimeAfter(entry, settings.workStartHour)) {
    statusFlags.push('Late Entry');
  }

  let totalGrossMins = 0;
  let lunchMins = 0;
  let dinnerMins = 0;

  // --- SHIFT 1 WORKED TIME ---
  if (entry) {
    const entryMins = timeToMinutes(entry);
    const exitMins1 = exit ? timeToMinutes(exit) : 0;
    
    if (exitMins1 > 0) {
      if (exitMins1 < entryMins) {
        // Crossed midnight
        totalGrossMins += (24 * 60 - entryMins) + exitMins1;
      } else {
        totalGrossMins += exitMins1 - entryMins;
      }
    } else {
      // Shift 1 still active
      if (lunchOut && !lunchIn) {
        statusFlags.push('On Lunch');
      } else if (dinnerOut && !dinnerIn) {
        statusFlags.push('On Dinner');
      } else {
        statusFlags.push('Active');
      }
    }
  }

  // --- SHIFT 2 WORKED TIME (IF PRESENT) ---
  if (entry2) {
    if (entry) {
      statusFlags.push('Double Shift');
    }
    const entryMins2 = timeToMinutes(entry2);
    const exitMins2 = exit2 ? timeToMinutes(exit2) : 0;

    if (exitMins2 > 0) {
      if (exitMins2 < entryMins2) {
        // Crossed midnight
        totalGrossMins += (24 * 60 - entryMins2) + exitMins2;
      } else {
        totalGrossMins += exitMins2 - entryMins2;
      }
    } else {
      // Shift 2 still active
      if (dinnerOut && !dinnerIn) {
        statusFlags.push('On Dinner');
      } else if (lunchOut && !lunchIn) {
        statusFlags.push('On Lunch');
      } else {
        statusFlags.push('Active (Shift 2)');
      }
    }
  }

  // Lunch break calculation
  if (lunchOut) {
    if (lunchIn) {
      const loMins = timeToMinutes(lunchOut);
      const liMins = timeToMinutes(lunchIn);
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
  if (dinnerOut) {
    if (dinnerIn) {
      const doMins = timeToMinutes(dinnerOut);
      const diMins = timeToMinutes(dinnerIn);
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

  // Evaluate new rules
  if (!isCurrentlyActive) {
    // Fully checked out or absent
    if (totalHours < 3) {
      isAbsent = true;
    } else if (totalHours < (settings.standardHours || 8) || hasMorningLateEntry || hasEarlyExitHalfDay) {
      isHalfDay = true;
    }
  } else {
    // Informational: mark as Half Day immediately if their check-in was late (after 10:00 AM)
    if (hasMorningLateEntry) {
      isHalfDay = true;
    }
  }

  let overtime = 0;

  if (isAbsent) {
    totalHours = 0;
    overtime = 0;
    statusFlags.push('Absent');
  } else {
    if (isHalfDay) {
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
  multiplier: number = 1.5
): {
  regularPay: number;
  overtimePay: number;
  totalPay: number;
} => {
  const standardWork = Math.max(0, hoursWorked - overtimeHours);
  const regularPay = Math.round(standardWork * hourlyRate * 100) / 100;
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
    name: "Calitech Engineering Solutions pvt.ltd",
    radiusMeters: 200
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

  const isWithinRange = minDistance <= closestLocation.radiusMeters;

  return {
    isWithinRange,
    distance: Math.round(minDistance),
    matchedLocationName: closestLocation.name
  };
}
