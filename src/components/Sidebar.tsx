import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  FileSpreadsheet, 
  FileBarChart2, 
  LogOut, 
  ShieldAlert,
  Building2,
  Menu,
  X,
  Calendar,
  Lock,
  Receipt
} from 'lucide-react';
import { Employee } from '../types';
import CESLogo from './CESLogo';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isAdminLoggedIn: boolean;
  loggedInEmployee: Employee | null;
  onLogout: () => void;
  onEmployeeLogout: () => void;
  companyName: string;
  onToggleSidebar?: () => void;
  isOpen?: boolean;
  layoutMode?: 'mobile' | 'desktop';
}

export default function Sidebar({
  currentView,
  onViewChange,
  isAdminLoggedIn,
  loggedInEmployee,
  onLogout,
  onEmployeeLogout,
  companyName,
  isOpen = true,
  onToggleSidebar,
  layoutMode = 'desktop'
}: SidebarProps) {
  const menuItems = [
    {
      id: 'dashboard',
      name: 'Workforce Dashboard',
      icon: LayoutDashboard,
      description: 'Analytics & Live state',
      adminOnly: true,
    },
    {
      id: 'terminal',
      name: loggedInEmployee ? 'My Punch Card' : 'Attendance Kiosk',
      icon: Clock,
      description: loggedInEmployee ? 'Clock In / Out / break' : 'Check-In/Out Desk',
      adminOnly: false,
    },
    ...(loggedInEmployee ? [
      {
        id: 'my-attendance',
        name: 'My Attendance Logs',
        icon: FileSpreadsheet,
        description: 'View datewise logs & download',
        adminOnly: false,
      },
      {
        id: 'my-expenses',
        name: 'My Expenses',
        icon: Receipt,
        description: 'Submit claims & view status',
        adminOnly: false,
      },
      {
        id: 'rules',
        name: 'Rules & Guidelines',
        icon: Building2,
        description: 'Half Day, Overtime & Punch Policies',
        adminOnly: false,
      },
      {
        id: 'leaves',
        name: 'My Leave Requests',
        icon: Calendar,
        description: 'Request Sickness / Vacation',
        adminOnly: false,
      }
    ] : []),
    {
      id: 'employees',
      name: 'Employee profiles',
      icon: Users,
      description: 'Staff directory & Wage rates',
      adminOnly: true,
    },
    {
      id: 'reports',
      name: 'Financial Reports',
      icon: FileBarChart2,
      description: 'Payroll & Overtime',
      adminOnly: true,
    },
    {
      id: 'expenses-admin',
      name: 'Expense Management',
      icon: Receipt,
      description: 'Approve, reject & edit amount',
      adminOnly: true,
    },
    {
      id: 'rules',
      name: 'Rules & Guidelines',
      icon: Building2,
      description: 'Half Day, Overtime & Punch Policies',
      adminOnly: true,
    },
    ...(!loggedInEmployee ? [
      {
        id: 'leaves',
        name: 'Leave Management',
        icon: Calendar,
        description: 'Submit & Review Leaves',
        adminOnly: false,
      }
    ] : []),
    {
      id: 'sync',
      name: 'Google Sheets Integration',
      icon: FileSpreadsheet,
      description: 'Google Suite configuration',
      adminOnly: true,
    },
  ];

  const isFixed = layoutMode === 'desktop';

  return (
    <>
      {/* Mobile Sidebar overlay */}
      {isOpen && (
        <div 
          className={`${isFixed ? 'fixed' : 'absolute'} inset-0 bg-slate-900/40 backdrop-blur-sm z-30 ${layoutMode === 'desktop' ? 'lg:hidden' : ''} print:hidden`}
          onClick={onToggleSidebar}
        />
      )}

      {/* Main Sidebar */}
      <aside 
        id="app-sidebar"
        className={`${isFixed ? 'fixed' : 'absolute'} top-0 bottom-0 left-0 z-40 w-72 bg-[#111827] text-gray-300 flex flex-col border-r border-[#1f2937] shadow-xl transition-transform duration-300 transform print:hidden ${
          layoutMode === 'desktop' ? 'lg:translate-x-0' : ''
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#1f2937] bg-[#0b0f19]">
          <CESLogo size="sidebar" variant="full" />
          {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className={`${layoutMode === 'desktop' ? 'lg:hidden' : ''} text-gray-400 hover:text-white cursor-pointer bg-gray-800/40 p-1.5 rounded-lg border border-gray-800 hover:bg-gray-850`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User profile capsule */}
        <div className="p-4 mx-4 mt-4 mb-2 rounded-xl bg-[#1f2937]/50 border border-gray-800/60">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {isAdminLoggedIn ? (
                <span className="inline-block h-9 w-9 overflow-hidden rounded-full bg-[#111827] flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700">
                  AD
                </span>
              ) : loggedInEmployee ? (
                loggedInEmployee.photoUrl ? (
                  <img 
                    src={loggedInEmployee.photoUrl} 
                    alt={loggedInEmployee.name} 
                    className="h-9 w-9 rounded-full object-cover border border-gray-700" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="inline-block h-9 w-9 overflow-hidden rounded-full bg-[#111827] flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700">
                    {loggedInEmployee.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </span>
                )
              ) : (
                <span className="inline-block h-9 w-9 overflow-hidden rounded-full bg-[#111827] flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700">
                  KS
                </span>
              )}
              <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-gray-905 ${
                isAdminLoggedIn ? 'bg-indigo-500' : loggedInEmployee ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {isAdminLoggedIn ? 'Administrator' : loggedInEmployee ? loggedInEmployee.name : 'Kiosk Terminal'}
              </p>
              <p className="text-[10px] text-gray-450 truncate">
                {isAdminLoggedIn ? 'Full Access Mode' : loggedInEmployee ? `${loggedInEmployee.id} | ${loggedInEmployee.department}` : 'Public Clock-In Kiosk'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto font-sans">
          {menuItems.filter(item => !item.adminOnly || isAdminLoggedIn).map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;

            // Render admin tags or skip if user doesn't have privileges
            const showBlocked = item.adminOnly && !isAdminLoggedIn;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center justify-between text-left px-6 py-2.5 border-l-4 transition-all group cursor-pointer ${
                  isActive 
                    ? 'bg-[#1f2937] text-white border-l-[#6366f1]' 
                    : 'text-gray-450 border-transparent hover:bg-[#1f2937]/55 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                    isActive ? 'text-[#6366f1]' : 'text-gray-500 group-hover:text-gray-300'
                  }`} />
                  <div>
                    <span className="text-xs font-bold block">
                      {item.name}
                    </span>
                    <span className={`text-[9.5px] block transition-colors leading-tight ${
                      isActive ? 'text-indigo-300' : 'text-gray-550 group-hover:text-gray-400'
                    }`}>
                      {item.description}
                    </span>
                  </div>
                </div>
                {item.adminOnly && (
                  <span className={`text-[8px] uppercase font-mono px-1 py-0.5 rounded flex items-center gap-0.5 ${
                    isActive
                      ? 'bg-[#6366f1]/20 text-[#6366f1]'
                      : 'bg-[#1f2937] text-gray-500 group-hover:text-[#6366f1] border border-gray-800'
                  }`}>
                    {showBlocked && <Lock className="w-2 h-2 text-gray-500" />}
                    <span>Admin</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-gray-800 bg-[#0b0f19]/50 space-y-2">
          {isAdminLoggedIn ? (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-rose-900/30 bg-rose-950/30 hover:bg-rose-900/20 text-rose-350 text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Unauthorize Administrator</span>
            </button>
          ) : loggedInEmployee ? (
            <button
              onClick={onEmployeeLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-rose-900/30 bg-rose-950/30 hover:bg-rose-900/20 text-rose-350 text-xs font-bold transition-colors cursor-pointer animate-pulse"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Exit Employee Cabin</span>
            </button>
          ) : (
            <button
              onClick={() => onViewChange('admin-login')}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-750 hover:text-white text-gray-350 text-xs font-bold transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
              <span>Sign In Portal</span>
            </button>
          )}
          <div className="text-center pt-1.5 border-t border-gray-850/40">
            <p className="text-[9px] text-gray-650 font-mono uppercase tracking-widest">
              Calitech Active Node
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
