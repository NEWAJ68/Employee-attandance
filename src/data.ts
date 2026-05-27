import { Employee, AttendanceRecord, Settings } from './types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'CES001',
    name: 'Nabadip Das',
    department: 'Engineering',
    email: 'nabadip.das@calitech.com',
    hourlyRate: 35,
    joinedDate: '2025-01-15',
    status: 'Active',
  },
  {
    id: 'CES002',
    name: 'Shahmim Newaj',
    department: 'Engineering',
    email: 'shahmim.newaj@calitech.com',
    hourlyRate: 40,
    joinedDate: '2025-02-10',
    status: 'Active',
  },
  {
    id: 'CES003',
    name: 'Dibakar Choudhury',
    department: 'Engineering',
    email: 'dibakar.choudhury@calitech.com',
    hourlyRate: 38,
    joinedDate: '2025-03-01',
    status: 'Active',
  }
];

export const INITIAL_SETTINGS: Settings = {
  companyName: 'Calitech Engineering Solution',
  standardHours: 8,
  lunchDurationMinutes: 60,
  overtimeRateMultiplier: 1.5,
  workStartHour: '10:00',
  workEndHour: '17:00',
  currency: 'USD',
};

// Generates some sensible attendance logs spanning the last few days
export const generateInitialAttendance = (todayStr: string): AttendanceRecord[] => {
  // Let's create records for:
  // - 2 days ago (e.g., May 23)
  // - 1 day ago (e.g., May 24)
  // - today (May 25, 2026)
  
  const getPastDateStr = (daysAgo: number): string => {
    const d = new Date(todayStr);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const dayMinus2 = getPastDateStr(2);
  const dayMinus1 = getPastDateStr(1);
  const dayToday = todayStr;

  return [
    // Day Minus 2
    {
      date: dayMinus2,
      employeeId: 'CES001',
      employeeName: 'Nabadip Das',
      entryTime: '08:52',
      lunchOut: '12:00',
      lunchIn: '13:00',
      exitTime: '18:15',
      totalHours: 8.38,
      overtime: 0.38,
      status: 'Present',
    },
    {
      date: dayMinus2,
      employeeId: 'CES002',
      employeeName: 'Shahmim Newaj',
      entryTime: '10:12',
      lunchOut: '13:00',
      lunchIn: '13:45',
      exitTime: '17:05',
      totalHours: 7.13,
      overtime: 0,
      status: 'Late Entry',
    },
    {
      date: dayMinus2,
      employeeId: 'CES003',
      employeeName: 'Dibakar Choudhury',
      entryTime: '08:58',
      lunchOut: '12:30',
      lunchIn: '13:30',
      exitTime: '17:00',
      totalHours: 8.0,
      overtime: 0,
      status: 'Present',
    },

    // Day Minus 1
    {
      date: dayMinus1,
      employeeId: 'CES001',
      employeeName: 'Nabadip Das',
      entryTime: '08:48',
      lunchOut: '12:10',
      lunchIn: '13:02',
      exitTime: '18:30',
      totalHours: 8.83,
      overtime: 0.83,
      status: 'Present',
    },
    {
      date: dayMinus1,
      employeeId: 'CES002',
      employeeName: 'Shahmim Newaj',
      entryTime: '08:57',
      lunchOut: '13:00',
      lunchIn: '14:00',
      exitTime: '17:30',
      totalHours: 7.55,
      overtime: 0,
      status: 'Present',
    },
    {
      date: dayMinus1,
      employeeId: 'CES003',
      employeeName: 'Dibakar Choudhury',
      entryTime: '10:15',
      lunchOut: '12:30',
      lunchIn: '13:30',
      exitTime: '16:45',
      totalHours: 6.5,
      overtime: 0,
      status: 'Late Entry & Early Exit',
    },

    // Today (May 25, 2026): Active state representation
    {
      date: dayToday,
      employeeId: 'CES001',
      employeeName: 'Nabadip Das',
      entryTime: '08:30',
      lunchOut: '12:00',
      lunchIn: '13:00',
      exitTime: '17:30',
      totalHours: 8.0,
      overtime: 0,
      status: 'Present',
    },
    {
      date: dayToday,
      employeeId: 'CES002',
      employeeName: 'Shahmim Newaj',
      entryTime: '08:55',
      lunchOut: '12:30',
      lunchIn: '',
      exitTime: '',
      totalHours: 0,
      overtime: 0,
      status: 'On Lunch',
    },
    {
      date: dayToday,
      employeeId: 'CES003',
      employeeName: 'Dibakar Choudhury',
      entryTime: '08:58',
      lunchOut: '12:00',
      lunchIn: '12:45',
      exitTime: '',
      totalHours: 0,
      overtime: 0,
      status: 'Present',
    }
  ];
};

