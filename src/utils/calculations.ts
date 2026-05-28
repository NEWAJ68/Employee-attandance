import { Settings } from '../types';

/**
 * Converts "HH:MM" string to minutes from start of day
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
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

  // Check late entry on Shift 1
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
    statusFlags.push('Double Shift');
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

  const totalHours = minutesToDecimalHours(netMins);

  // Overtime starts after standard hours
  const standardHours = settings.standardHours || 8;
  const overtime = totalHours > standardHours ? Math.round((totalHours - standardHours) * 100) / 100 : 0;

  // Early Exit Check on Shift 1 (only if no Shift 2 starts, or if they check out early on Shift 1)
  if (!entry2 && entry && exit && settings.workEndHour && isTimeBefore(exit, settings.workEndHour)) {
    statusFlags.push('Early Exit');
  }

  if (exit || exit2) {
    statusFlags.push('Present');
  }

  // Clean status flag duplicates
  const cleanedFlags = Array.from(new Set(statusFlags)).filter(f => f !== 'Active' || (!exit && !exit2));

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
    radiusMeters: 100
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
