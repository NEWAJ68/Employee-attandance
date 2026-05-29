export interface Employee {
  id: string; // e.g., "EMP-101"
  name: string;
  department: string;
  email: string;
  hourlyRate: number;
  joinedDate: string;
  status: 'Active' | 'Inactive';
  password?: string; // custom employee login passcode / PIN for privacy protection
  photoUrl?: string; // Base64 or image URL for profile photo
  address?: string; // residential address / pata
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  entryTime: string; // HH:MM
  lunchOut: string; // HH:MM (going to lunch)
  lunchIn: string; // HH:MM (returning from lunch)
  exitTime: string; // HH:MM
  entryTime2?: string; // HH:MM (Shift 2 Entry)
  exitTime2?: string; // HH:MM (Shift 2 Exit)
  dinnerOut?: string; // HH:MM (Dinner break start)
  dinnerIn?: string; // HH:MM (Dinner break end)
  totalHours: number; // calculated working hours
  overtime: number; // overtime hours (totalHours - 8, if > 8)
  status: string; // e.g., "Present", "On Lunch", "Absent", "Late Entry", etc.
  notes?: string;
  locationIn?: string;
  locationOut?: string;
  locationLunchOut?: string;
  locationLunchIn?: string;
  locationDinnerOut?: string;
  locationDinnerIn?: string;
  locationEntry2?: string;
  locationExit2?: string;
  isOutOfRange?: boolean;
  distanceFromHq?: number;
  photoIn?: string;
  photoOut?: string;
  photoLunchOut?: string;
  photoLunchIn?: string;
  photoDinnerOut?: string;
  photoDinnerIn?: string;
  photoEntry2?: string;
  photoExit2?: string;
}

export interface Settings {
  companyName: string;
  standardHours: number; // e.g., 8
  lunchDurationMinutes: number; // e.g., 60
  overtimeRateMultiplier: number; // e.g., 1.5
  workStartHour: string; // e.g., "09:00" for late calculations
  workEndHour: string; // e.g., "17:00" for early exit calculations
  currency: string; // Indian Rupee (₹) by default
  strictGeofencing?: boolean; // if true, blocks punches outside 100m of Calitech HQ
  autoSyncSheets?: boolean; // if true, automatically triggers background push on attendance create
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'Sick' | 'Vacation' | 'Personal' | 'Other';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Approved' | 'Rejected';
  notes: string;
  submittedAt: string; // ISO DateTime
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  timestamp: string; // ISO string or short time string
  read: boolean;
  isAdmin: boolean;
  employeeId?: string; // relevant employee record
  readByEmployees?: string[]; // track which employees read a broadcast notification
}

export interface AppState {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
  appsScriptUrl: string;
  syncEnabled: boolean;
  isAdminLoggedIn: boolean;
  theme: 'light' | 'dark';
}

