import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Mail, 
  Briefcase, 
  IndianRupee, 
  Calendar,
  AlertTriangle,
  Grid,
  Camera,
  Upload,
  Image,
  MapPin
} from 'lucide-react';
import { Employee, Settings } from '../types';

interface EmployeeProfilesProps {
  employees: Employee[];
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  settings: Settings;
}

const DEPARTMENTS = ['Engineering'];

export default function EmployeeProfiles({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  settings,
}: EmployeeProfilesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewStyle, setViewStyle] = useState<'cards' | 'gallery'>('cards');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [empIdInput, setEmpIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [deptInput, setDeptInput] = useState('Engineering');
  const [emailInput, setEmailInput] = useState('');
  const [hourlyRateInput, setHourlyRateInput] = useState<number | string>(25);
  const [statusInput, setStatusInput] = useState<'Active' | 'Inactive'>('Active');
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [addressInput, setAddressInput] = useState('');

  const openAddModal = () => {
    // Auto generate next employee ID
    const activeIds = employees.map(e => {
      const match = e.id.match(/\d+/);
      return match ? parseInt(match[0]) : 100;
    });
    const nextNum = activeIds.length > 0 ? Math.max(...activeIds) + 1 : 101;
    
    setEditingEmployee(null);
    setEmpIdInput(`EMP-${nextNum}`);
    setNameInput('');
    setDeptInput('Engineering');
    setEmailInput('');
    setHourlyRateInput(25);
    setStatusInput('Active');
    setPhotoUrlInput('');
    setAddressInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpIdInput(emp.id);
    setNameInput(emp.name);
    setDeptInput(emp.department);
    setEmailInput(emp.email);
    setHourlyRateInput(emp.hourlyRate);
    setStatusInput(emp.status);
    setPhotoUrlInput(emp.photoUrl || '');
    setAddressInput(emp.address || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameInput.trim() || !empIdInput.trim()) {
      alert('Representative ID and Staff Name parameters are required.');
      return;
    }

    const employeePayload: Employee = {
      id: empIdInput.trim().toUpperCase(),
      name: nameInput.trim(),
      department: deptInput,
      email: emailInput.trim() || `${nameInput.trim().toLowerCase().replace(/\s+/g, '.')}@company.com`,
      hourlyRate: Number(hourlyRateInput) || 20,
      joinedDate: editingEmployee ? editingEmployee.joinedDate : new Date().toISOString().split('T')[0],
      status: statusInput,
      photoUrl: photoUrlInput || undefined,
      address: addressInput.trim() || undefined,
    };

    if (editingEmployee) {
      onUpdateEmployee(employeePayload);
    } else {
      // Check for unique ID constraint
      if (employees.some(e => e.id === employeePayload.id)) {
        alert('This Employee ID already exists. Please pick a unique identifier.');
        return;
      }
      onAddEmployee(employeePayload);
    }

    closeModal();
  };

  const triggerDeletion = (id: string) => {
    onDeleteEmployee(id);
    setConfirmDeleteId(null);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;

    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-8 animate-fadeIn" id="employee-profiles-container">
      {/* Directory Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Workforce Director
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build, edit, and audit details, departments, and hourly wage allocations of company employees.
          </p>
        </div>
        <button
          onClick={openAddModal}
          id="btn-add-employee-trigger"
          className="flex items-center justify-center space-x-1 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer hover:shadow-indigo-600/10 transition-all font-sans"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee Profile</span>
        </button>
      </div>

      {/* Filter and search utilities bar */}
      <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search Input widget */}
        <div className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100/80 flex items-center space-x-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees by name, identity ID, or emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-0 outline-none ring-0 w-full text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0 select-text"
          />
        </div>

        {/* Filters dropdown widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-slate-450 text-xs font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-650 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-505 mr-1"
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* View Toggles */}
          <div className="flex items-center bg-slate-100/80 border border-slate-200/50 p-0.5 rounded-xl self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setViewStyle('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-bold font-sans transition-all cursor-pointer ${
                viewStyle === 'cards'
                  ? 'bg-white shadow-3xs text-slate-800 border border-slate-100/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewStyle('gallery')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-bold font-sans transition-all cursor-pointer ${
                viewStyle === 'gallery'
                  ? 'bg-white shadow-3xs text-indigo-650 border border-slate-100/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Image className="w-3.5 h-3.5" />
              <span>Photo Gallery</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content Area */}
      {viewStyle === 'gallery' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fadeIn" id="gallery-view-grid">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-full text-center py-24 bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-slate-550">
              <Users className="w-12 h-12 text-slate-300 stroke-1 mx-auto mb-3" />
              <p className="font-semibold text-sm">No Employee Profiles Discovered</p>
              <p className="text-2xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                Your search filters returned zero matching indices. Try resetting values or adding a new employee profile card.
              </p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const colors = [
                'from-indigo-500 to-violet-500 text-white',
                'from-teal-500 to-emerald-500 text-white',
                'from-amber-400 to-orange-500 text-white',
                'from-fuchsia-500 to-pink-500 text-white',
                'from-sky-500 to-blue-600 text-white'
              ];
              const sumChars = emp.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
              const chosenGradient = colors[sumChars % colors.length];

              return (
                <div 
                  key={emp.id}
                  className={`bg-white rounded-2xl border transition-all p-4 flex flex-col items-center text-center relative group ${
                    emp.status === 'Inactive' 
                      ? 'border-slate-100 opacity-70 bg-slate-50/50' 
                      : 'border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'
                  }`}
                >
                  {/* Photo Frame */}
                  <div className="relative w-20 h-20 mb-3 flex items-center justify-center shrink-0">
                    {emp.photoUrl ? (
                      <img 
                        src={emp.photoUrl} 
                        alt={emp.name} 
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-100 shadow-xs"
                      />
                    ) : (
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-tr ${chosenGradient} flex items-center justify-center font-bold text-xl ring-4 ring-slate-100 shadow-xs`}>
                        {initials}
                      </div>
                    )}
                    {/* Status Dot badge */}
                    <span 
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-3xs ${
                        emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                      title={emp.status === 'Active' ? 'Active Duty' : 'Suspended / Inactive'}
                    />
                  </div>

                  {/* Info Text */}
                  <div className="w-full text-center">
                    <h3 className="font-bold text-xs text-slate-800 line-clamp-1 mb-1" title={emp.name}>
                      {emp.name}
                    </h3>
                    <div className="font-mono text-[9px] text-slate-400 font-bold mb-2">
                      {emp.id}
                    </div>
                    <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100/40 px-2 py-0.5 rounded-full font-sans uppercase">
                      {emp.department}
                    </span>
                  </div>

                  {/* Overlay Config Trigger */}
                  <div className="mt-3.5 w-full flex justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      onClick={() => openEditModal(emp)}
                      className="w-full py-1.5 text-[9px] font-bold text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-150 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Configure</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Grid listing profiles cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="cards-view-grid">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-24 bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-slate-550">
              <Users className="w-12 h-12 text-slate-300 stroke-1 mx-auto mb-3" />
              <p className="font-semibold text-sm">No Employee Profiles Discovered</p>
              <p className="text-2xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                Your search filters returned zero matching indices. Try resetting values or adding a new employee profile card.
              </p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              // Generate initials
              const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              
              // Build dynamic backdrop values
              const colors = [
                'from-indigo-500 to-violet-500 text-white',
                'from-teal-500 to-emerald-500 text-white',
                'from-amber-400 to-orange-500 text-white',
                'from-fuchsia-500 to-pink-500 text-white',
                'from-sky-500 to-blue-600 text-white'
              ];
              const sumChars = emp.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
              const chosenGradient = colors[sumChars % colors.length];

              const isConfirming = confirmDeleteId === emp.id;

              return (
                <div 
                  key={emp.id} 
                  className={`bg-white rounded-2xl border transition-all p-5 relative flex flex-col justify-between ${
                    emp.status === 'Inactive' 
                      ? 'border-slate-100 opacity-70 bg-slate-55/10' 
                      : 'border-slate-100 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Card Actions Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        {emp.photoUrl ? (
                          <img 
                            src={emp.photoUrl} 
                            alt={emp.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover ring-4 ring-slate-100 shadow-3xs shrink-0" 
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-max bg-gradient-to-tr ${chosenGradient} flex items-center justify-center font-bold text-xs ring-4 ring-slate-100 rounded-full shrink-0`}>
                            {initials}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{emp.name}</h3>
                          <span className="text-3xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/30 uppercase tracking-wider font-bold">
                            {emp.id}
                          </span>
                        </div>
                      </div>

                      {/* Active/Inactive status indicator */}
                      <span className={`text-[10px] font-bold uppercase tracking-wide font-mono px-2 py-0.5 rounded border ${
                        emp.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {emp.status}
                      </span>
                    </div>

                    {/* Profile properties */}
                    <div className="space-y-2.5 py-2 text-xs text-slate-600 border-t border-b border-slate-50 mt-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>{emp.department} Dept</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-500 font-mono text-[11px] line-clamp-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{emp.email}</span>
                      </div>
                      {emp.address && (
                        <div className="flex items-start space-x-2 text-slate-500 text-[11px] line-clamp-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{emp.address}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-800">
                        <div className="flex items-center space-x-2">
                          <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Hourly Wage:</span>
                        </div>
                        <span className="font-bold font-mono text-indigo-600 text-sm">
                          ₹{emp.hourlyRate.toFixed(2)}/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Trigger actions or Delete confirmations */}
                  <div className="pt-3 flex justify-between gap-2 border-t border-slate-50/50">
                    {isConfirming ? (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-2 w-full flex items-center justify-between gap-4 animate-scaleUp">
                        <div className="flex items-center space-x-1">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span className="text-3xs text-rose-800 font-bold uppercase font-mono">Delete client?</span>
                        </div>
                        <div className="flex space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => triggerDeletion(emp.id)}
                            className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-rose-700 cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-slate-300 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 hover:bg-slate-50 border border-slate-200/65 rounded-xl text-slate-600 hover:text-slate-800 text-3xs font-bold uppercase font-sans tracking-wider transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-450" />
                          <span>Edit Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(emp.id)}
                          className="flex items-center justify-center p-2 rounded-xl border border-rose-100 hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL FORM SHEET OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-tr from-slate-905 to-slate-900 border-b border-slate-100 p-5 flex items-center justify-between text-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-base">
                  {editingEmployee ? 'Edit Employee Details' : 'Register New Employee'}
                </h2>
              </div>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                    ID Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingEmployee}
                    value={empIdInput}
                    onChange={(e) => setEmpIdInput(e.target.value)}
                    placeholder="e.g. EMP-101"
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 font-mono font-bold text-xs rounded-xl focus:ring-1 focus:ring-indigo-501 outline-none text-slate-700 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                    Staff Status
                  </label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-501 focus:border-indigo-505 text-slate-700"
                  >
                    <option value="Active">Active Duty</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Sarah Connor"
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:ring-1 focus:ring-indigo-501 outline-none text-slate-750 font-medium"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                  Company Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:ring-1 focus:ring-indigo-505 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                  Residential Address (घर का पता / Pata)
                </label>
                <textarea
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="Type full address details (e.g. House No, Gali/Street, City, State, ZIP)..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:ring-1 focus:ring-indigo-550 focus:border-indigo-550 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                  Profile Portrait Photo
                </label>
                <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200/85 p-3 rounded-xl">
                  {photoUrlInput ? (
                    <div className="relative">
                      <img 
                        src={photoUrlInput} 
                        alt="Preview" 
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 ring-2 ring-indigo-50"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoUrlInput('')}
                        className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white p-0.5 rounded-full shadow-md cursor-pointer transition-all"
                        title="Remove photo"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPhotoUrlInput(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                      id="profile-upload-input"
                    />
                    <label 
                      htmlFor="profile-upload-input"
                      className="inline-flex items-center space-x-1.5 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-3xs font-black uppercase text-indigo-650 tracking-wider rounded-lg transition-all cursor-pointer shadow-3xs"
                    >
                      <Upload className="w-3" />
                      <span>Upload Profile Image</span>
                    </label>
                    <p className="text-[9px] text-slate-400 mt-1">Accepts JPG, PNG formats.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                    Department Unit
                  </label>
                  <select
                    value={deptInput}
                    onChange={(e) => setDeptInput(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-505 text-slate-705"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-500 mb-1 font-mono">
                    Hourly Wage Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="0.01"
                    required
                    value={hourlyRateInput}
                    onChange={(e) => setHourlyRateInput(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 text-xs rounded-xl font-bold font-mono text-slate-750 focus:ring-1 focus:ring-indigo-505 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  id="btn-employee-form-cancel"
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-200/80 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-employee-form-submit"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
