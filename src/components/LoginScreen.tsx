import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, UserCheck, LogIn, Lock, HelpCircle, Users, UserPlus, Mail, Briefcase, IndianRupee, CheckCircle } from 'lucide-react';
import { Employee } from '../types';
import CESLogo from './CESLogo';

interface LoginScreenProps {
  onLogin: (role: 'admin' | 'employee', employeeId?: string) => void;
  companyName: string;
  employees: Employee[];
  onAddEmployee: (employee: Employee) => void;
}

export default function LoginScreen({ onLogin, companyName, employees, onAddEmployee }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('employee'); // default to employee since they check in/out most!
  
  // Admin form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Employee form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empPin, setEmpPin] = useState(''); // Employee ID serves as security pin (e.g., EMP-101)

  // Registration form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDept, setRegDept] = useState('Engineering');
  const [regRate, setRegRate] = useState('25');
  const [regMonthlySalary, setRegMonthlySalary] = useState('15000');

  const handleRegMonthlySalaryChange = (value: string) => {
    setRegMonthlySalary(value);
    const salaryVal = parseFloat(value);
    if (!isNaN(salaryVal) && salaryVal > 0) {
      // Automatic hourly wage based on: (salary / 30) / 8 hours
      const calculatedWage = Math.round(((salaryVal / 30) / 8) * 100) / 100;
      setRegRate(calculatedWage.toString());
    } else {
      setRegRate('0');
    }
  };

  const [regId, setRegId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  // Forgot password form states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const activeEmployees = employees.filter(emp => emp.status === 'Active');

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotId.trim()) {
      setForgotError('Employee ID is required.');
      return;
    }
    if (!forgotEmail.trim()) {
      setForgotError('Registered email address is required.');
      return;
    }

    const targetEmp = employees.find(
      emp => emp.id.toUpperCase().trim() === forgotId.toUpperCase().trim()
    );

    if (!targetEmp) {
      setForgotError('Could not find worker profile matching this ID.');
      return;
    }

    if (targetEmp.email.toLowerCase().trim() !== forgotEmail.toLowerCase().trim()) {
      setForgotError('The provided email does not match our records for this ID.');
      return;
    }

    // Success: reveal current password or fallback to ID
    const recoveredPassword = targetEmp.password || targetEmp.id;
    setForgotSuccess(`Verification Successful! Your private password / passcode is: "${recoveredPassword}". You can use it to login now.`);
  };

  // Generate next Employee ID when opening registration
  useEffect(() => {
    if (isRegistering && !regId) {
      const ids = employees.map(e => {
        const match = e.id.match(/^CES(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      });
      const max = ids.length > 0 ? Math.max(...ids) : 0;
      const nextId = `CES${String(max + 1).padStart(3, '0')}`;
      setRegId(nextId);
    }
  }, [isRegistering, employees, regId]);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regName.trim()) {
      setError('Staff Full Name is required.');
      return;
    }
    if (!regEmail.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!regId.trim()) {
      setError('Employee ID is required.');
      return;
    }

    const cleanId = regId.toUpperCase().trim();
    // Validate character format
    if (!/^[A-Z0-9-]{3,15}$/.test(cleanId)) {
      setError('Employee ID must be 3-15 alphanumeric characters.');
      return;
    }

    // Check duplicate ID
    if (employees.some(emp => emp.id.toUpperCase() === cleanId)) {
      setError(`Employee ID "${cleanId}" is already taken by another staff member.`);
      return;
    }

    if (!regPassword.trim()) {
      setError('A private password / passcode is required to protect your privacy.');
      return;
    }
    if (regPassword.length < 4) {
      setError('Private passcode / password must be at least 4 characters long.');
      return;
    }

    const newEmp: Employee = {
      id: cleanId,
      name: regName.trim(),
      department: regDept,
      email: regEmail.trim(),
      hourlyRate: parseFloat(regRate) || 25,
      monthlySalary: parseFloat(regMonthlySalary) || 0,
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      password: regPassword.trim(),
    };

    onAddEmployee(newEmp);

    // Show success banner and auto populate the login state
    setRegSuccessMsg(`Account created! ${newEmp.name} (ID: ${newEmp.id}) is now registered. Please login with your password.`);
    setSelectedEmpId(newEmp.id);
    setEmpPin(regPassword.trim());
    
    // Clear registration controls
    setRegName('');
    setRegEmail('');
    setRegDept('Engineering');
    setRegRate('25');
    setRegMonthlySalary('15000');
    setRegId('');
    setRegPassword('');
    
    // Smooth transition back to portal view after a delay
    setTimeout(() => {
      setIsRegistering(false);
      setRegSuccessMsg('');
    }, 2800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (activeTab === 'admin') {
        if (username.toLowerCase() === 'admin' && password === 'admin123') {
          onLogin('admin');
        } else {
          setError('Incorrect administrator username or password.');
          setIsLoading(false);
        }
      } else {
        // Employee logic
        if (!selectedEmpId) {
          setError('Please select an employee profile to log in.');
          setIsLoading(false);
          return;
        }
        
        // Find target employee profile
        const targetEmp = activeEmployees.find(e => e.id === selectedEmpId);
        if (targetEmp) {
          const isMatched = targetEmp.password
            ? empPin.trim() === targetEmp.password.trim()
            : empPin.toUpperCase().trim() === targetEmp.id;

          if (isMatched) {
            onLogin('employee', targetEmp.id);
          } else {
            setError(targetEmp.password ? 'Incorrect private password. Please try again.' : `Incorrect passcode. Pre-seeded fallback passcode is exactly your Employee ID (${selectedEmpId}).`);
            setIsLoading(false);
          }
        } else {
          setError('Employee profile was not found.');
          setIsLoading(false);
        }
      }
    }, 600);
  };

  const handleDemoFill = (role: 'admin' | 'employee', empId?: string) => {
    setError('');
    if (role === 'admin') {
      setActiveTab('admin');
      setUsername('admin');
      setPassword('admin123');
    } else if (role === 'employee' && empId) {
      setActiveTab('employee');
      setSelectedEmpId(empId);
      const targetEmp = activeEmployees.find(e => e.id === empId);
      setEmpPin(targetEmp?.password || empId); // Fill custom password or ID key fallback
    }
  };

  if (isRegistering) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center py-6 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
        {/* Decorative ambient blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo-50/50 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-emerald-50/30 blur-3xl pointer-events-none"></div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 flex flex-col items-center">
          <CESLogo size="lg" className="mb-3" />
          <h2 className="text-center text-xl font-bold text-slate-900 tracking-tight">
            Employee Sign Up Portal
          </h2>
          <p className="mt-1 text-center text-xs text-slate-500">
            Create your profile to join the squad and start logging shifts securely.
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="bg-white py-8 px-6 shadow-md shadow-slate-100 rounded-2xl border border-slate-100 sm:px-10">
            {regSuccessMsg ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex items-center justify-center bg-emerald-50 text-emerald-550 p-4 rounded-full border border-emerald-100">
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Registration Complete</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {regSuccessMsg}
                </p>
                <p className="text-xs font-semibold text-indigo-600 animate-pulse pt-2">
                  Building your portal workstation...
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                {error && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-start space-x-2 text-xs">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="reg-name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Enter full real name"
                    className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. name@calitech.com"
                    className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-dept" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Department
                  </label>
                  <select
                    id="reg-dept"
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Sales">Sales & Marketing</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="reg-rate" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                      Hourly OT Wage (₹)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <input
                        id="reg-rate"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={regRate}
                        onChange={(e) => setRegRate(e.target.value)}
                        className="appearance-none block w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono font-bold transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-salary" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                      Monthly Salary (₹)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <input
                        id="reg-salary"
                        type="number"
                        min="100"
                        step="0.01"
                        required
                        value={regMonthlySalary}
                        onChange={(e) => handleRegMonthlySalaryChange(e.target.value)}
                        placeholder="e.g. 15000"
                        className="appearance-none block w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono font-bold transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-id" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Assigned ID Key
                  </label>
                  <input
                    id="reg-id"
                    type="text"
                    required
                    value={regId}
                    onChange={(e) => setRegId(e.target.value.toUpperCase().trim())}
                    placeholder="e.g. CES004"
                    className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono font-bold transition-all text-indigo-650 tracking-wider"
                  />
                  <p className="text-[10px] text-slate-400 font-sans leading-normal">
                    * The system pre-fills this unique ID key. Write it down; it is your unique corporate ID.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Create Private Log-In Password / PIN
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Set private passcode (e.g., 1234 or secure word)"
                    className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono font-bold transition-all text-emerald-650"
                  />
                  <p className="text-[10px] text-slate-400 font-sans leading-normal">
                    * Choose a personal password. This keeps your clock-in, clock-out logs and personal wages completely private.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Create My Account</span>
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setRegSuccessMsg('');
                      setError('');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    Already registered? Back to Portal Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-6 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative ambient blobs */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo-50/50 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-emerald-50/30 blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 flex flex-col items-center">
        <CESLogo size="lg" className="mb-3" />
        <h2 className="text-center text-xl font-bold text-slate-900 tracking-tight">
          Workforce Kiosk Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Sign in to log shifts, manage leave sheets, or administer workforce operations.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10" id="login-container">
        {/* Tab Buttons selection container */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('employee');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'employee'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Employee Portal</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Admin Operator</span>
          </button>
        </div>

        <div className="bg-white py-8 px-6 shadow-md shadow-slate-100 rounded-2xl border border-slate-100 sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-start space-x-2 text-xs animate-shake">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'employee' ? (
              // EMPLOYEE LOGIN FIELDS
              <>
                <div className="space-y-1">
                  <label htmlFor="employee-select" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Select Your Profile Name
                  </label>
                  <select
                    id="employee-select"
                    required
                    value={selectedEmpId}
                    onChange={(e) => {
                      setSelectedEmpId(e.target.value);
                      setEmpPin(e.target.value); // Populate pin preview for easy login
                    }}
                    className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
                  >
                    <option value="">-- Click to choose your profile --</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="employee-pin" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Private Password or passcode
                  </label>
                  <input
                    id="employee-pin"
                    type="password"
                    required
                    value={empPin}
                    onChange={(e) => setEmpPin(e.target.value)}
                    placeholder="Enter your personal password / PIN"
                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono font-bold transition-all"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1.5 pt-1 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      * Enter your custom passcode to protect your records.
                    </p>
                    <div className="flex items-center space-x-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotModalOpen(true);
                          setForgotId(selectedEmpId);
                          setForgotEmail('');
                          setForgotError('');
                          setForgotSuccess('');
                        }}
                        className="text-[11px] font-extrabold text-amber-600 hover:text-amber-700 transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
                      >
                        Forgot Password?
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegistering(true);
                          setError('');
                        }}
                        className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // ADMIN LOGIN FIELDS
              <>
                <div className="space-y-1">
                  <label htmlFor="admin-username" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Admin Username
                  </label>
                  <input
                    id="admin-username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all"
                    placeholder="e.g. admin"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Secret Key Password
                  </label>
                  <input
                    id="admin-password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to {activeTab === 'employee' ? 'Employee Cabin' : 'Administrator space'}</span>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 relative max-h-[90vh] overflow-y-auto text-left">
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors font-bold text-md cursor-pointer"
            >
              ✕
            </button>
            
            <div className="flex items-center space-x-2.5 mb-4 border-b border-slate-50 pb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <HelpCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Password Recovery Desk</h3>
                <p className="text-[9px] text-slate-400 font-mono tracking-wide uppercase">Identity Verification</p>
              </div>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl text-xs space-y-1.5 leading-normal">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-955">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Identity Verified!</span>
                  </p>
                  <p className="font-sans font-medium text-slate-700">{forgotSuccess}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Proceed to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-[11.5px] text-slate-500 leading-relaxed font-medium">
                  Please identify your registered Employee ID and core email address to automatically retrieve your private passcode PIN:
                </p>

                {forgotError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-750 p-2.5 rounded-xl text-xs font-semibold leading-normal">
                    ⚠️ {forgotError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Employee ID Key
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CES001"
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value.toUpperCase().trim())}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. nabadip@calitech.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 font-semibold"
                  />
                </div>

                <div className="pt-2 flex items-center space-x-3 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer text-center"
                  >
                    Verify & Reveal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
