import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  MapPin, 
  Eye, 
  Clock, 
  Search, 
  RefreshCw, 
  AlertCircle,
  Camera,
  CheckCircle,
  HelpCircle,
  X,
  Filter,
  User,
  ArrowRight,
  ChevronRight,
  Briefcase,
  Layers,
  FileText
} from 'lucide-react';
import { Employee, AttendanceRecord, Settings } from '../types';
import { formatDateDMY } from '../utils/calculations';

interface AttendanceRosterViewProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: Settings;
}

export default function AttendanceRosterView({
  employees,
  attendance,
  settings
}: AttendanceRosterViewProps) {
  // Filters state
  const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // Default to current month "YYYY-MM"
  });
  const [selectedDate, setSelectedDate] = useState<string>(''); // Default empty (all dates of the month)
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selfie Modal state
  const [activeSelfieUrl, setActiveSelfieUrl] = useState<{ 
    url: string; 
    label: string; 
    name: string; 
    date: string; 
    time: string; 
    location?: string;
  } | null>(null);

  // Clear all filters
  const resetFilters = () => {
    setSelectedEmpId('ALL');
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    setSelectedDate('');
    setSearchQuery('');
  };

  // Pre-filtered employees list for dropdown search
  const filteredEmployeesList = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  // Main filtered attendance records list
  const filteredRecords = useMemo(() => {
    return attendance.filter(rec => {
      // 1. Employee filter
      if (selectedEmpId !== 'ALL' && rec.employeeId !== selectedEmpId) {
        return false;
      }

      // 2. Date vs Month filter
      if (selectedDate) {
        // Match exact date (YYYY-MM-DD)
        if (rec.date !== selectedDate) {
          return false;
        }
      } else if (selectedMonth) {
        // Match month (YYYY-MM)
        if (rec.date.substring(0, 7) !== selectedMonth) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort newest dates first
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // If same date, sort by employee ID
      return a.employeeId.localeCompare(b.employeeId);
    });
  }, [attendance, selectedEmpId, selectedMonth, selectedDate]);

  // Find employee additional info helper
  const getEmployeeCachedInfo = (empId: string) => {
    return employees.find(emp => emp.id === empId);
  };

  // Helper to test if a time is actually punched
  const isPunched = (timeStr: string | undefined | null) => {
    if (!timeStr) return false;
    const clean = timeStr.trim();
    return clean !== '' && clean !== '--:--' && clean !== '-' && clean !== '00:00';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-4 animate-fadeIn font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider block w-fit mb-2">
            Verification & Audit Desk
          </span>
          <h1 className="text-xl font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Audit Desk</span>
          </h1>
          <p className="text-xs text-slate-400">
            Audit historical logs, inspect user selfies, tracking distances, and GPS boundaries for compliance check.
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="px-3.5 py-2 bg-indigo-50 hover:bg-slate-100 text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-100 shadow-3xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Audit Filtering Board */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
        <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs font-mono uppercase pb-2 border-b border-slate-50">
          <Filter className="w-4 h-4" />
          <span>Configure Search Parameters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Select Employee */}
          <div className="space-y-1">
            <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450">
              Select Staff Member
            </label>
            <div className="relative">
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-705 appearance-none"
              >
                <option value="ALL">All Staff Members ({employees.length})</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.id} - {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
            {/* Quick Filter dropdown search text filter */}
            {employees.length > 8 && (
              <div className="relative pt-1.5">
                <input
                  type="text"
                  placeholder="Type to filter list..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg text-4xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 bottom-1.5 text-slate-400 hover:text-slate-600 text-xxs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                {searchQuery && (
                  <div className="absolute left-0 right-0 top-full bg-white border border-slate-150 rounded-lg z-20 max-h-32 overflow-y-auto shadow-md p-1 mt-1 font-sans text-xxs">
                    {filteredEmployeesList.length === 0 ? (
                      <p className="text-slate-400 p-1">No matching workers</p>
                    ) : (
                      filteredEmployeesList.map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmpId(e.id);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-2 py-1 hover:bg-indigo-50 hover:text-indigo-650 rounded text-slate-700 font-bold flex justify-between"
                        >
                          <span>{e.name}</span>
                          <span className="font-mono text-slate-400">{e.id}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Month Input */}
          <div className="space-y-1">
            <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450">
              Select Month
            </label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedDate(''); // Reset specific date if month shifts
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono text-slate-700 cursor-pointer"
              />
              {!selectedMonth && (
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-5xs font-bold text-rose-500 font-mono">ALL MONTHS</span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 leading-normal block">
              Filters records of a single calendar month.
            </span>
          </div>

          {/* Date Picker */}
          <div className="space-y-1">
            <label className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450">
              Select Specific Date (Optional)
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (e.target.value) {
                    // Update month text matching selection
                    setSelectedMonth(e.target.value.substring(0, 7));
                  }
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono text-slate-700 cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 cursor-pointer p-1 font-bold text-xxs"
                  title="Clear Date"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-[9px] text-slate-400 leading-normal block">
              Overrules month selection for atomic search.
            </span>
          </div>

          {/* Summary Stats Capsule */}
          <div className="bg-slate-50/75 border border-slate-100 rounded-2xl p-3 flex flex-col justify-center min-h-[50px] space-y-1 text-center md:text-left">
            <span className="text-3xs text-slate-400 font-mono uppercase tracking-wider font-bold">
              Matching Records
            </span>
            <div className="flex items-baseline justify-center md:justify-start space-x-1.5">
              <span className="text-lg font-black text-indigo-650">{filteredRecords.length}</span>
              <span className="text-4xs text-slate-400 font-semibold">attendance logs</span>
            </div>
            <div className="text-[9px] text-slate-450 leading-tight">
              {selectedEmpId === 'ALL' ? 'Across all ' : `${selectedEmpId} `}On {selectedDate ? formatDateDMY(selectedDate) : selectedMonth ? new Date(selectedMonth + "-02").toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'All Time'}
            </div>
          </div>
        </div>
      </div>

      {/* Roster Match Feed List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto shadow-3xs space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <AlertCircle className="w-6 h-6 stroke-1" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">No Attendance Records Found</h3>
            <p className="text-xs text-slate-400 leading-normal">
              There are no recorded punch-in history logs matching the selected employee, month, or date coordinates.
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Clear Search Constraints
          </button>
        </div>
      ) : (
        <div className="space-y-4 font-sans">
          {filteredRecords.slice(0, 50).map((record, index) => {
            const empInfo = getEmployeeCachedInfo(record.employeeId);
            
            return (
              <div 
                key={`${record.employeeId}-${record.date}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-3xs overflow-hidden relative border-l-4 border-l-indigo-500 hover:shadow-2xs transition-shadow"
              >
                {/* Out Of Range Alert Header Banner */}
                {record.isOutOfRange && (
                  <div className="bg-rose-50 border-b border-rose-100/50 px-4 py-1.5 flex items-center space-x-2 text-rose-700 text-3xs font-semibold uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                    <span>Compliance Flag: Check-In occurred outside authorized Geofencing range ({record.distanceFromHq?.toFixed(1) || '100+'}m away from office)</span>
                  </div>
                )}

                {/* Main Card Body */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* Left Column: Worker info */}
                  <div className="flex items-start space-x-3.5 min-w-[200px] lg:max-w-[280px] shrink-0">
                    <div className="relative shrink-0">
                      {empInfo?.photoUrl ? (
                        <img 
                          src={empInfo.photoUrl} 
                          alt={record.employeeName} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-100" 
                          referrerPolicy="referrer"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-205">
                          {record.employeeName.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-50 rounded-full border border-white text-emerald-600 font-bold text-[8px]" title="ID Verified">
                        <CheckCircle className="w-3 h-3 fill-emerald-50" />
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-3xs font-black text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded">
                          {record.employeeId}
                        </span>
                        <span className="text-3xs text-slate-400 font-mono font-semibold">
                          {empInfo?.department || 'Staff'}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-800 leading-tight truncate">
                        {record.employeeName}
                      </h4>
                      
                      <div className="flex items-center gap-2 pt-0.5 text-4xs font-mono font-bold text-slate-450">
                        <Calendar className="w-2.5 h-2.5" />
                        <span className="uppercase">{formatDateDMY(record.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Chronological Verification Timeline */}
                  <div className="flex-1 overflow-x-auto pb-2 -mx-5 px-5 lg:mx-0 lg:px-0">
                    <div className="flex items-center space-x-3.5 min-w-[580px] py-1">
                      
                      {/* Timeline Node 1: Shift 1 Entry */}
                      <TimelineNode
                        id="entry"
                        label="Check-In"
                        time={record.entryTime}
                        photo={record.photoIn}
                        location={record.locationIn}
                        worksite={record.selectedWorkLocation}
                        isOutOfRange={record.isOutOfRange}
                        distance={record.distanceFromHq}
                        colorClass="bg-emerald-50 border-emerald-150 text-emerald-800"
                        iconColorText="text-emerald-600"
                        empName={record.employeeName}
                        dateStr={formatDateDMY(record.date)}
                        onViewSelfie={setActiveSelfieUrl}
                      />

                      <TimelinePointer />

                      {/* Timeline Node 2: Lunch Out */}
                      <TimelineNode
                        id="lunch-out"
                        label="Lunch Out"
                        time={record.lunchOut}
                        photo={record.photoLunchOut}
                        location={record.locationLunchOut}
                        colorClass="bg-amber-50 border-amber-150 text-amber-800"
                        iconColorText="text-amber-600"
                        empName={record.employeeName}
                        dateStr={formatDateDMY(record.date)}
                        onViewSelfie={setActiveSelfieUrl}
                      />

                      <TimelinePointer />

                      {/* Timeline Node 3: Lunch In */}
                      <TimelineNode
                        id="lunch-in"
                        label="Lunch In"
                        time={record.lunchIn}
                        photo={record.photoLunchIn}
                        location={record.locationLunchIn}
                        colorClass="bg-amber-55 bg-amber-50/65 border-amber-150 text-amber-800"
                        iconColorText="text-amber-600"
                        empName={record.employeeName}
                        dateStr={formatDateDMY(record.date)}
                        onViewSelfie={setActiveSelfieUrl}
                      />

                      <TimelinePointer />

                      {/* Timeline Node 4: Shift 2 Input */}
                      {isPunched(record.entryTime2) ? (
                        <>
                          <TimelineNode
                            id="entry-shift2"
                            label="Shift 2 In"
                            time={record.entryTime2}
                            photo={record.photoEntry2}
                            location={record.locationEntry2}
                            colorClass="bg-indigo-50 border-indigo-150 text-indigo-805"
                            iconColorText="text-indigo-600"
                            empName={record.employeeName}
                            dateStr={formatDateDMY(record.date)}
                            onViewSelfie={setActiveSelfieUrl}
                          />
                          <TimelinePointer />
                        </>
                      ) : null}

                      {/* Timeline Node 5: Shift 2 Exit */}
                      {isPunched(record.exitTime2) ? (
                        <>
                          <TimelineNode
                            id="exit-shift2"
                            label="Shift 2 Out"
                            time={record.exitTime2}
                            photo={record.photoExit2}
                            location={record.locationExit2}
                            colorClass="bg-indigo-50 border-indigo-150 text-indigo-805"
                            iconColorText="text-indigo-600"
                            empName={record.employeeName}
                            dateStr={formatDateDMY(record.date)}
                            onViewSelfie={setActiveSelfieUrl}
                          />
                          <TimelinePointer />
                        </>
                      ) : null}

                      {/* Timeline Node 6: Dinner Out */}
                      {isPunched(record.dinnerOut) ? (
                        <>
                          <TimelineNode
                            id="dinner-out"
                            label="Dinner Out"
                            time={record.dinnerOut}
                            photo={record.photoDinnerOut}
                            location={record.locationDinnerOut}
                            colorClass="bg-purple-50 border-purple-150 text-purple-800"
                            iconColorText="text-purple-600"
                            empName={record.employeeName}
                            dateStr={formatDateDMY(record.date)}
                            onViewSelfie={setActiveSelfieUrl}
                          />
                          <TimelinePointer />
                        </>
                      ) : null}

                      {/* Timeline Node 7: Dinner In */}
                      {isPunched(record.dinnerIn) ? (
                        <>
                          <TimelineNode
                            id="dinner-in"
                            label="Dinner In"
                            time={record.dinnerIn}
                            photo={record.photoDinnerIn}
                            location={record.locationDinnerIn}
                            colorClass="bg-purple-50 border-purple-150 text-purple-800"
                            iconColorText="text-purple-600"
                            empName={record.employeeName}
                            dateStr={formatDateDMY(record.date)}
                            onViewSelfie={setActiveSelfieUrl}
                          />
                          <TimelinePointer />
                        </>
                      ) : null}

                      {/* Timeline Node 8: Shift 1 Exit */}
                      <TimelineNode
                        id="exit"
                        label="Check-Out"
                        time={record.exitTime}
                        photo={record.photoOut}
                        location={record.locationOut}
                        colorClass="bg-rose-50 border-rose-150 text-rose-800"
                        iconColorText="text-rose-600"
                        empName={record.employeeName}
                        dateStr={formatDateDMY(record.date)}
                        onViewSelfie={setActiveSelfieUrl}
                      />

                    </div>
                  </div>

                  {/* Right Column: Attendance Status Tag Details */}
                  <div className="shrink-0 flex flex-col justify-center items-end bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-[130px] space-y-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 capitalize tracking-wide block w-full text-right">
                      Work Duration
                    </span>
                    <strong className="text-xs font-mono font-black text-slate-800">
                      {record.totalHours?.toFixed(2)} Hrs Active
                    </strong>
                    {record.overtime > 0 && (
                      <span className="text-xxs font-mono font-bold text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded tracking-tight">
                        + {record.overtime?.toFixed(2)} OT Hrs
                      </span>
                    )}
                    <div className="pt-2 text-right">
                      <span className={`inline-block py-1 px-2 rounded-full text-4xs uppercase tracking-wider font-extrabold ${getColoredStatusClass(record.status)}`}>
                        {record.status || 'Active'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Notes/Remark Footer block if any exists */}
                {record.notes && (
                  <div className="bg-slate-50 border-t border-slate-100/60 px-5 py-2.5 flex items-start space-x-2 text-xxs text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700">Audit Desk Remarks:</span> {record.notes}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
          
          {filteredRecords.length > 50 && (
            <p className="text-center font-mono text-3xs text-slate-400 font-bold uppercase tracking-wider pt-2">
              Viewing oldest 50 matched records. Narrow your search constraints using filters to find specific outcomes.
            </p>
          )}
        </div>
      )}

      {/* Selfie Preview Zoom Modal Dialog Overlay */}
      {activeSelfieUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99] animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 relative">
            {/* Close Button icon */}
            <button
              onClick={() => setActiveSelfieUrl(null)}
              className="absolute top-4 right-4 rounded-xl bg-slate-150 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-205 transition-colors font-bold text-md cursor-pointer shadow-3xs"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Modal Title bar */}
            <div className="flex items-center space-x-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 shadow-3xs">
                <Camera className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 pr-8">
                <span className="text-[9px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">
                  {activeSelfieUrl.label}
                </span>
                <h3 className="text-xs font-black text-slate-800 truncate">
                  {activeSelfieUrl.name}
                </h3>
              </div>
            </div>

            {/* Compressed Selfie image renderer */}
            <div className="relative aspect-square w-full rounded-2xl bg-slate-100 overflow-hidden border border-slate-150 flex items-center justify-center shadow-3xs">
              <img 
                src={activeSelfieUrl.url} 
                alt={`${activeSelfieUrl.name} - verification`} 
                className="object-cover w-full h-full"
                referrerPolicy="referrer" 
              />
            </div>

            {/* Selfie Verification context specs */}
            <div className="mt-4 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2 text-xxs font-mono text-slate-600 bg-slate-50 rounded-2xl p-3">
              <div>
                <span className="text-4xs text-slate-400 block uppercase font-mono font-bold">Punch Date:</span>
                <strong className="text-slate-800 font-extrabold">{activeSelfieUrl.date}</strong>
              </div>
              <div>
                <span className="text-4xs text-slate-400 block uppercase font-mono font-bold">Punch Time:</span>
                <strong className="text-indigo-650 font-extrabold">{activeSelfieUrl.time}</strong>
              </div>
              {activeSelfieUrl.location && (
                <div className="col-span-2 border-t border-slate-150/50 pt-2 flex justify-between items-center mt-1">
                  <div>
                    <span className="text-4xs text-slate-400 block uppercase font-mono font-bold">GPS Coordinate Pin:</span>
                    <span className="text-5xs text-slate-700 leading-tight font-bold">{activeSelfieUrl.location}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${activeSelfieUrl.location}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1 px-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-150 text-teal-700 font-bold text-[9px] rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    title="Open Pin in Google Maps"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    <span>View Map</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Colored status class utility helper
function getColoredStatusClass(statusString: string | undefined): string {
  if (!statusString) return 'bg-slate-100 text-slate-650';
  const clean = statusString.toUpperCase();

  if (clean.includes('PRESENT')) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-100';
  }
  if (clean.includes('LATE')) {
    return 'bg-amber-50 text-amber-700 border border-amber-100';
  }
  if (clean.includes('ABSENT')) {
    return 'bg-rose-50 text-rose-800 border border-rose-100';
  }
  if (clean.includes('LUNCH') || clean.includes('BREAK')) {
    return 'bg-cyan-50 text-cyan-800 border border-cyan-150';
  }
  if (clean.includes('HALF')) {
    return 'bg-orange-50 text-orange-850 border border-orange-100';
  }
  
  return 'bg-indigo-50 text-indigo-750 border border-indigo-100';
}

// Compact line arrow spacer
function TimelinePointer() {
  return (
    <div className="text-slate-300 flex items-center p-0 cursor-default">
      <ChevronRight className="w-3.5 h-3.5" />
    </div>
  );
}

interface TimelineNodeProps {
  id: string;
  label: string;
  time: string | undefined;
  photo: string | undefined;
  location: string | undefined;
  worksite?: string;
  isOutOfRange?: boolean;
  distance?: number;
  colorClass: string;
  iconColorText: string;
  empName: string;
  dateStr: string;
  onViewSelfie: (data: { 
    url: string; 
    label: string; 
    name: string; 
    date: string; 
    time: string; 
    location?: string;
  }) => void;
}

// Compact verification timeline card inside the list
function TimelineNode({
  id,
  label,
  time,
  photo,
  location,
  worksite,
  isOutOfRange,
  distance,
  colorClass,
  iconColorText,
  empName,
  dateStr,
  onViewSelfie
}: TimelineNodeProps) {
  
  const hasTime = time && time !== '--:--' && time !== '-' && time !== '00:00';
  
  if (!hasTime) {
    return (
      <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 min-w-[130px] flex flex-col justify-between h-[68px] opacity-45 cursor-default select-none group">
        <div>
          <span className="block text-[8px] font-mono tracking-wider font-extrabold text-slate-400 uppercase leading-none">{label}</span>
          <span className="block text-3xs font-black text-slate-350 pt-1">--:--</span>
        </div>
        <span className="block text-[8.5px] leading-tight font-semibold text-slate-400 group-hover:text-slate-450 transition-colors">Not Punched</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-3 border min-w-[135px] flex flex-col justify-between h-[68px] shadow-3xs relative transition-all hover:border-slate-300 ${colorClass}`}>
      
      {/* Label and Punch clock time */}
      <div>
        <div className="flex justify-between items-center">
          <span className="block text-[8px] font-mono tracking-wider font-black uppercase leading-none opacity-65">{label}</span>
          
          {/* Work location indicator inside first punch if any */}
          {worksite && (
            <span className="text-[7.5px] font-mono px-1 py-0.2 bg-teal-50 border border-teal-150 text-teal-800 rounded font-black max-w-[50px] truncate" title={`Worksite Selection: ${worksite}`}>
              {worksite}
            </span>
          )}
        </div>
        <span className="block text-3xs font-black pt-1 font-mono tracking-tight flex items-center gap-1 text-slate-805">
          <Clock className={`w-2.5 h-2.5 ${iconColorText}`} />
          <span>{time}</span>
        </span>
      </div>

      {/* Attachments & location verify layout */}
      <div className="flex items-center justify-between border-t border-black/5 pt-1.5 mt-1">
        <span className="text-[8px] font-semibold text-slate-500 truncate mr-1">Identity:</span>
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Selfie attachment view button */}
          {photo ? (
            <button
              type="button"
              onClick={() => onViewSelfie({ 
                url: photo, 
                label: `${label} Verification Photo`, 
                name: empName,
                date: dateStr,
                time: time 
              })}
              className="inline-flex items-center text-[8px] text-indigo-600 bg-white hover:bg-slate-50 p-0.5 rounded-full border border-indigo-150 transition-all shrink-0 cursor-pointer shadow-3xs hover:scale-105"
              title="View Selfie Image"
            >
              <img src={photo} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ) : (
            <span className="text-[7px] text-slate-400 bg-slate-100 p-0.5 rounded border border-slate-200" title="No Photo Attached">
              No photo
            </span>
          )}

          {/* Location link pin button */}
          {location ? (
            <a
              href={`https://www.google.com/maps?q=${location}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center p-1 rounded border transition-colors shrink-0 ${
                isOutOfRange 
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200' 
                  : 'text-teal-600 bg-white hover:bg-teal-50 border-slate-200 hover:border-teal-300'
              }`}
              title={isOutOfRange ? `Out Of Range: click map pointer to inspect (${distance?.toFixed(0) || ''}m)` : "Check GPS verification coordinates"}
            >
              <MapPin className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="text-[7px] text-slate-400 bg-slate-100 p-0.5 rounded border border-slate-200" title="No GPS Captured">
              No GPS
            </span>
          )}

        </div>
      </div>

    </div>
  );
}
