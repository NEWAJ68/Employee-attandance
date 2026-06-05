import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, UserCheck, LogIn, Lock, HelpCircle, Users, UserPlus, Mail, Briefcase, IndianRupee, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Employee, Settings } from '../types';
import CESLogo from './CESLogo';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface LoginScreenProps {
  onLogin: (role: 'admin' | 'employee', employeeId?: string) => void;
  companyName: string;
  employees: Employee[];
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee?: (employee: Employee, originalId?: string) => void;
  settings?: Settings;
}

export default function LoginScreen({ onLogin, companyName, employees, onAddEmployee, onUpdateEmployee, settings }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('employee'); // default to employee since they check in/out most!
  
  const [isQuotaExceededOffline, setIsQuotaExceededOffline] = useState(() => {
    try {
      return localStorage.getItem('apex_quota_exceeded') === 'true';
    } catch {
      return false;
    }
  });

  const handleReconnect = () => {
    try {
      localStorage.removeItem('apex_local_only_mode');
      localStorage.removeItem('apex_quota_exceeded');
      setIsQuotaExceededOffline(false);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  // Admin form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  // Employee form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empPin, setEmpPin] = useState(''); // Employee ID serves as security pin (e.g., EMP-101)

  // Registration form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDept, setRegDept] = useState('Engineering');
  const [regDesignation, setRegDesignation] = useState('');
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
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admin forgot password recovery states
  const [isAdminForgotModalOpen, setIsAdminForgotModalOpen] = useState(false);
  const [adminRecoveryInput, setAdminRecoveryInput] = useState('');
  const [adminRecoveryError, setAdminRecoveryError] = useState('');
  const [adminRecoverySuccess, setAdminRecoverySuccess] = useState('');
  const [recoveredUser, setRecoveredUser] = useState('');
  const [recoveredPass, setRecoveredPass] = useState('');

  const handleAdminForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminRecoveryError('');
    setAdminRecoverySuccess('');
    setRecoveredUser('');
    setRecoveredPass('');

    const trimmedInput = adminRecoveryInput.trim();
    if (!trimmedInput) {
      setAdminRecoveryError('Recovery PIN cannot be empty.');
      return;
    }

    const expectedRecoveryPin = settings?.adminRecoveryKey || '123456';
    if (trimmedInput === expectedRecoveryPin) {
      const u = settings?.adminUsername || 'admin';
      const p = settings?.adminPassword || 'Admin123?@';
      setRecoveredUser(u);
      setRecoveredPass(p);
      setAdminRecoverySuccess(`Security PIN verification complete. Your administrator credentials have been securely retrieved below:`);
    } else {
      setAdminRecoveryError('Incorrect private backup recovery PIN. Please verify your PIN and try again.');
    }
  };

  const handleAdminGoogleVerify = async () => {
    setIsLoading(true);
    setAdminRecoveryError('');
    setAdminRecoverySuccess('');
    setRecoveredUser('');
    setRecoveredPass('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user?.email ? result.user.email.toLowerCase() : '';
      const allowedAdminEmail = (settings?.adminEmail || 'shamimnewaj68@gmail.com').toLowerCase();
      const allowedAdminSecondary = (settings?.adminEmailSecondary || '').toLowerCase();

      const isAuthorized = userEmail === allowedAdminEmail || 
                            userEmail === 'shamimnewaj68@gmail.com' ||
                            (allowedAdminSecondary && userEmail === allowedAdminSecondary);

      if (isAuthorized) {
        const u = settings?.adminUsername || 'admin';
        const p = settings?.adminPassword || 'Admin123?@';
        setRecoveredUser(u);
        setRecoveredPass(p);
        setAdminRecoverySuccess(`Google Account verification complete. Welcome back! Your administrator credentials have been securely recovered below:`);
      } else {
        const emailList = allowedAdminSecondary ? `${allowedAdminEmail} or ${allowedAdminSecondary}` : allowedAdminEmail;
        setAdminRecoveryError(`Unauthorized Gmail (${result.user?.email || 'Unknown'}). Only registered verification Gmail addresses (${emailList}) are authorized.`);
      }
    } catch (err: any) {
      console.error('Google Admin verification error: ', err);
      setAdminRecoveryError(err.message || 'Google account verification failed. Please make sure you are online and accept browser login popups.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeEmployees = employees.filter(emp => emp.status === 'Active');

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotId) {
      setForgotError('Please select your profile name.');
      return;
    }
    if (!forgotNewPassword.trim()) {
      setForgotError('Please enter a new password passcode.');
      return;
    }
    if (forgotNewPassword.length < 4) {
      setForgotError('Passcode / Password must be at least 4 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Confirm password does not match new password.');
      return;
    }

    const targetEmp = employees.find(
      emp => emp.id === forgotId
    );

    if (!targetEmp) {
      setForgotError('Could not find worker profile matching this ID.');
      return;
    }

    // Success: change the password and call the update handler
    if (onUpdateEmployee) {
      const updatedEmp: Employee = {
        ...targetEmp,
        password: forgotNewPassword.trim()
      };
      onUpdateEmployee(updatedEmp);
    }

    setForgotSuccess(`Your private password was successfully changed to your new passcode. You can now close this door and log in!`);
    
    // Auto-prefill password inputs for quick login
    setSelectedEmpId(forgotId);
    setEmpPin(forgotNewPassword.trim());
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
      designation: regDesignation.trim() || undefined,
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
    setRegDesignation('');
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
        const expectedUser = (settings?.adminUsername || 'admin').toLowerCase();
        const expectedPass = settings?.adminPassword || 'Admin123?@';
        if (
          (username.toLowerCase() === expectedUser && password === expectedPass) ||
          (username.toLowerCase() === 'admin' && (password === 'admin123' || password === 'Admin123?@'))
        ) {
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
      setUsername(settings?.adminUsername || 'admin');
      setPassword(settings?.adminPassword || 'Admin123?@');
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
                    className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505 font-semibold"
                  >
                    <option value="Engineering">Engineering</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-designation" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Designation
                  </label>
                  <input
                    id="reg-designation"
                    type="text"
                    value={regDesignation}
                    onChange={(e) => setRegDesignation(e.target.value)}
                    placeholder="e.g. Technician / Engineer"
                    className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all font-semibold"
                  />
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
          Calitech Workforce Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Sign in to log shifts, manage leave sheets, or administer workforce operations.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10" id="login-container">
        {isQuotaExceededOffline && (
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-2xl shadow-md border border-amber-500 mb-4 text-xs font-sans leading-normal">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Database Offline Mode is Active! (डेटाबेस ऑफलाइन है)</p>
                <p className="mt-1 text-amber-100 text-[11.5px] leading-relaxed">
                  Your device is stored in <strong>Local Cache</strong> mode because your daily Firestore quota was exceeded earlier today.
                </p>
                <p className="mt-1.5 text-amber-200 bg-amber-950/25 px-2 py-1.5 rounded-lg border border-amber-550/30 font-medium text-[11px] leading-relaxed">
                  🇮🇳 <strong>Daily Limit Reset Note (कोटा रीसेट):</strong> Google Cloud Free Limit resets happen at <strong>12:30 PM afternoon India Time (IST)</strong>.
                  सुबह 3:00 बजे रीसेट नहीं होता है। चूँकि दोपहर के 12:30 बज चुके हैं, आप सीधे नीचे री-कनेक्ट करें।
                </p>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="mt-3.5 w-full py-2 bg-white hover:bg-amber-100 text-amber-950 font-extrabold text-[11px] tracking-wide uppercase rounded-xl transition-all active:scale-[0.98] cursor-pointer text-center outline-none border-0"
                >
                  🔄 Reconnect Online Now (डेटाबेस से पुनः जुड़ें)
                </button>
              </div>
            </div>
          </div>
        )}

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
                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505 text-xs transition-all font-semibold"
                    placeholder="e.g. admin"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                    Secret Key Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="admin-password"
                      name="password"
                      type={showAdminPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505 text-xs font-mono transition-all font-semibold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-650 transition-colors p-1"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminForgotModalOpen(true);
                        setAdminRecoveryInput('');
                        setAdminRecoveryError('');
                        setAdminRecoverySuccess('');
                        setRecoveredUser('');
                        setRecoveredPass('');
                      }}
                      className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
                    >
                      Forgot Admin Password?
                    </button>
                  </div>
                </div>

                {(!settings?.adminPassword || settings.adminPassword === 'admin123' || settings.adminPassword === 'Admin123?@') && (
                  <div className="bg-amber-50 border border-amber-100/60 rounded-xl p-3.5 text-[10.5px] text-amber-800 leading-normal flex items-start space-x-2 animate-pulse mt-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Default Credentials:</strong> This workspace is currently configured with the administrator password <strong>"Admin123?@"</strong> (or fallback <strong>"admin123"</strong>). Change this in the settings panel to secure your reports.
                    </span>
                  </div>
                )}
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
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <KeyRound className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Secure Password Reset Desk</h3>
                <p className="text-[9px] text-slate-400 font-mono tracking-wide uppercase">Profile Verification</p>
              </div>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl text-xs space-y-1.5 leading-normal">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-955">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Password Reset Successful!</span>
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
                  Select your profile name and set a new login passcode:
                </p>

                {forgotError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-750 p-2.5 rounded-xl text-xs font-semibold leading-normal">
                    ⚠️ {forgotError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Select Your Profile Name
                  </label>
                  <select
                    required
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold cursor-pointer text-slate-800"
                  >
                    <option value="">-- Choose your profile --</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Create New Passcode
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Enter new 4+ digit passcode"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-650 transition-colors p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Confirm New Passcode
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Confirm new passcode"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-650 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                    Reset Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Admin Forgot Password Recovery Modal */}
      {isAdminForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 relative max-h-[90vh] overflow-y-auto text-left space-y-4">
            <button
              onClick={() => setIsAdminForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-660 transition-colors font-bold text-md cursor-pointer"
            >
              ✕
            </button>
            
            <div className="flex items-center space-x-2.5 mb-2 border-b border-slate-50 pb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Admin Keychain Desk</h3>
                <p className="text-[9px] text-amber-600 font-mono tracking-wide uppercase font-bold">Owner Verification</p>
              </div>
            </div>

            {adminRecoverySuccess ? (
              <div className="space-y-4 py-2">
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-850 p-4 rounded-xl text-xs space-y-3 leading-normal">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-955">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Identity Verified Successfully!</span>
                  </p>
                  
                  <div className="bg-white/85 border border-emerald-100/40 p-3 rounded-xl space-y-2 text-slate-800 font-mono text-[11px]">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">USERNAME:</span>
                      <strong className="text-indigo-650">{recoveredUser}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PASSWORD:</span>
                      <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{recoveredPass}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUsername(recoveredUser);
                    setPassword(recoveredPass);
                    setIsAdminForgotModalOpen(false);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Autofill & Close Recovery Desk</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[11px] text-slate-500 leading-normal">
                  Please verify your identity using one of the two secure verification methods below to retrieve administrative credentials:
                </p>

                {/* Method 1: Google Verifier */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2.5">
                  <span className="block text-[10px] font-bold text-indigo-600 uppercase font-mono tracking-wider">
                    Method 1: Google Identity Check
                  </span>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Securely verify ownership of your registered admin recovery email (<strong>{settings?.adminEmail || 'shamimnewaj68@gmail.com'}</strong>{settings?.adminEmailSecondary ? <> or <strong>{settings.adminEmailSecondary}</strong></> : null}).
                  </p>
                  <button
                    type="button"
                    onClick={handleAdminGoogleVerify}
                    className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-750 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-2xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z"
                      />
                    </svg>
                    <span>Verify with Google Account</span>
                  </button>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-150"></div>
                  <span className="flex-shrink mx-3 text-[9px] text-slate-400 font-bold font-mono">OR</span>
                  <div className="flex-grow border-t border-slate-150"></div>
                </div>

                {/* Method 2: PIN recovery Form */}
                <form onSubmit={handleAdminForgotSubmit} className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2.5">
                    <span className="block text-[10px] font-bold text-indigo-650 uppercase font-mono tracking-wider text-indigo-600">
                      Method 2: Private Backup Recovery PIN
                    </span>
                    
                    <div className="space-y-1">
                      <label htmlFor="admin-pin-pass" className="block text-3xs font-mono font-bold uppercase tracking-wider text-slate-450 mb-1">
                        Enter Secret Admin PIN Code
                      </label>
                      <input
                        id="admin-pin-pass"
                        type="password"
                        required
                        placeholder="••••••"
                        value={adminRecoveryInput}
                        onChange={(e) => setAdminRecoveryInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-indigo-500 font-bold tracking-widest placeholder:tracking-normal"
                      />
                      <span className="text-[9px] text-slate-400 leading-normal block pt-1 font-medium">
                        Enter your private 6-digit administrator backup recovery PIN to reveal login credentials.
                      </span>
                    </div>
                  </div>

                  {adminRecoveryError && (
                    <p className="text-[10.5px] text-rose-600 font-medium leading-normal bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                      ⚠️ {adminRecoveryError}
                    </p>
                  )}

                  <div className="pt-2 flex items-center space-x-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setIsAdminForgotModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl transition-all cursor-pointer text-center"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer text-center"
                    >
                      Verify PIN & Reveal
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
