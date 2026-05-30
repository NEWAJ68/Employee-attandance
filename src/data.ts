import { Employee, AttendanceRecord, Settings } from './types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'CES001',
    name: 'Nabadip Das',
    department: 'Engineering',
    designation: 'Senior Developer',
    email: 'nabadip.das@calitech.com',
    hourlyRate: 35,
    joinedDate: '2025-01-15',
    status: 'Active',
    address: 'House No. 12, Zoo Road, Guwahati, Assam - 781024',
  },
  {
    id: 'CES002',
    name: 'Shahmim Newaj',
    department: 'Engineering',
    designation: 'Project Lead',
    email: 'shahmim.newaj@calitech.com',
    hourlyRate: 40,
    joinedDate: '2025-02-10',
    status: 'Active',
    address: 'Calitech Staff Campus, Hudumpur, Guwahati, Assam - 781015',
  },
  {
    id: 'CES003',
    name: 'Dibakar Choudhury',
    department: 'Engineering',
    designation: 'System Administrator',
    email: 'dibakar.choudhury@calitech.com',
    hourlyRate: 38,
    joinedDate: '2025-03-01',
    status: 'Active',
    address: 'Palashbari Near Airport, Guwahati, Assam - 781122',
  }
];

export const INITIAL_SETTINGS: Settings = {
  companyName: 'Calitech Engineering Solutions Pvt. Ltd.',
  standardHours: 8,
  lunchDurationMinutes: 60,
  overtimeRateMultiplier: 1.5,
  workStartHour: '10:00',
  workEndHour: '17:00',
  currency: 'INR',
  strictGeofencing: true,
  autoSyncSheets: true,
  fixedShiftLocations: ['Hetero Changsari'],
};

// Generates some sensible attendance logs spanning the last few days
export const generateInitialAttendance = (todayStr: string): AttendanceRecord[] => {
  return [];
};


