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
  currency: 'INR',
};

// Generates some sensible attendance logs spanning the last few days
export const generateInitialAttendance = (todayStr: string): AttendanceRecord[] => {
  return [];
};


