import React, { useState } from 'react';
import { 
  Receipt,
  User,
  Calendar,
  Check,
  X,
  Edit2,
  FileText,
  Search,
  ChevronDown,
  AlertCircle,
  Eye,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react';
import { Employee, Expense, AppNotification } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, cleanFirestoreData } from '../firebase';

interface ExpenseManagementProps {
  employees: Employee[];
  expenses: Expense[];
  onAddNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'alert' | 'success',
    employeeId?: string
  ) => void;
}

export default function ExpenseManagementView({
  employees,
  expenses,
  onAddNotification
}: ExpenseManagementProps) {
  // Filters state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // Default to current month "YYYY-MM"
  });
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Editing state for partial/adjusted approvals
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<string>('');
  
  // Administrative comments state
  const [adminRemarkExpenseId, setAdminRemarkExpenseId] = useState<string | null>(null);
  const [adminRemarkText, setAdminRemarkText] = useState<string>('');

  // Receipt visual zoom state
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Filter application
  const filteredExpenses = expenses.filter(exp => {
    const matchesEmp = selectedEmployeeId === 'All' || exp.employeeId === selectedEmployeeId;
    const matchesMonth = !selectedMonth || exp.date.startsWith(selectedMonth);
    const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
    const matchesSearch = exp.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exp.remark.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          exp.expenseType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesEmp && matchesMonth && matchesStatus && matchesSearch;
  });

  // KPI aggregates based on currently filtered subset or overall month
  const monthExpenses = expenses.filter(exp => !selectedMonth || exp.date.startsWith(selectedMonth));
  const totalClaimsSum = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalApprovedSum = monthExpenses.filter(e => e.status === 'Approved').reduce((sum, item) => sum + item.amount, 0);
  const totalPendingSum = monthExpenses.filter(e => e.status === 'Pending').reduce((sum, item) => sum + item.amount, 0);
  const pendingCount = monthExpenses.filter(e => e.status === 'Pending').length;

  // Handle direct Quick approval
  const handleDecideExpense = async (expenseId: string, decision: 'Pending' | 'Approved' | 'Rejected', finalAmount?: number, remarkStr?: string) => {
    const target = expenses.find(e => e.id === expenseId);
    if (!target) return;

    const validatedAmount = finalAmount !== undefined ? finalAmount : target.amount;
    const finalRemark = remarkStr !== undefined ? remarkStr : (target.adminRemark || '');

    const updatedExpense: Expense = {
      ...target,
      status: decision,
      amount: validatedAmount,
      adminRemark: finalRemark.trim() || undefined
    };

    try {
      await setDoc(doc(db, 'expenses', expenseId), cleanFirestoreData(updatedExpense));

      // Create a nice push alert notification to inform employee about decisions
      if (onAddNotification) {
        onAddNotification(
          `Expense Claim ${decision}`,
          `Your ${target.expenseType} claim for ₹${validatedAmount.toLocaleString()} has been ${decision.toLowerCase()} by administration.${finalRemark ? ` Remarks: ${finalRemark}` : ''}`,
          decision === 'Approved' ? 'success' : 'warning',
          target.employeeId
        );
      }

      // Reset action states
      setEditingExpenseId(null);
      setAdminRemarkExpenseId(null);
    } catch (err) {
      console.error('Failed to update expense status in Firestore:', err);
      handleFirestoreError(err, OperationType.WRITE, `expenses/${expenseId}`);
    }
  };

  const startEditAmount = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditedAmount(exp.amount.toString());
  };

  const saveEditedAmount = async (expenseId: string) => {
    const freshAmount = parseFloat(editedAmount);
    if (isNaN(freshAmount) || freshAmount <= 0) {
      alert('Please submit a valid amount.');
      return;
    }
    const target = expenses.find(e => e.id === expenseId);
    if (target) {
      await handleDecideExpense(expenseId, target.status, freshAmount, target.adminRemark);
    }
  };

  const startAddRemark = (exp: Expense) => {
    setAdminRemarkExpenseId(exp.id);
    setAdminRemarkText(exp.adminRemark || '');
  };

  const saveAdminRemark = async (expenseId: string) => {
    const target = expenses.find(e => e.id === expenseId);
    if (target) {
      await handleDecideExpense(expenseId, target.status, target.amount, adminRemarkText);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="expense-mgmt-dashboard">
      {/* Page Title Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-indigo-650">
          <Receipt className="w-5 h-5 animate-pulse" />
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Employee Expense Management</h1>
        </div>
        <p className="text-xs text-slate-500">
          Audit employee out-of-pocket submissions, adjust claims, attach accounting comments & approve reimbursements.
        </p>
      </div>

      {/* KPI Performance Widgets for Specified Month */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Current Month Claims</span>
          <p className="text-xl font-black text-slate-900">₹{totalClaimsSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block font-mono">Vouchers under selected month</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-105 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Approved (Payroll Addition)</span>
          <p className="text-xl font-black text-emerald-600">₹{totalApprovedSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block font-mono">Added automatically to net monthly payouts</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Pending Claims Review</span>
          <p className="text-xl font-black text-amber-500">₹{totalPendingSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block font-mono">Unapproved total awaiting checks</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Unassigned Queue Count</span>
          <p className="text-xl font-black text-indigo-650">{pendingCount} tickets</p>
          <span className="text-[9px] text-slate-400 block font-mono">Action items awaiting decision</span>
        </div>
      </div>

      {/* Control Filters Area */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-2xs font-sans">
        {/* Filter Employee option */}
        <div className="space-y-1">
          <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Filter employee</label>
          <div className="relative">
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="All">All Staff Members</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
              ))}
            </select>
            <User className="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Filter Month option */}
        <div className="space-y-1">
          <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Filter working month</label>
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
            />
            <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Search bar input text */}
        <div className="space-y-1">
          <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Category or remark keyword</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search gasoline, ink, paper..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Status selection slider */}
        <div className="space-y-1 w-full">
          <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Claims Status</label>
          <div className="grid grid-cols-4 border border-slate-200 rounded-xl overflow-hidden leading-snug w-full bg-white text-[10px] sm:text-xs">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(badge => (
              <button
                key={badge}
                onClick={() => setStatusFilter(badge)}
                className={`py-2 px-1 text-center font-bold tracking-tight cursor-pointer transition-all truncate ${
                  statusFilter === badge 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {badge}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger listing queue table */}
      <div className="bg-white rounded-2xl border border-slate-105 shadow-sm overflow-hidden text-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-550 font-bold uppercase tracking-wider text-[9px] font-mono">
                <th className="py-3.5 px-5">Employee Info</th>
                <th className="py-3.5 px-4">Log Date</th>
                <th className="py-3.5 px-4">Category Type</th>
                <th className="py-3.5 px-4 text-center">Receipt Doc</th>
                <th className="py-3.5 px-4 text-right">Claims Amount</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Process status</th>
                <th className="py-3.5 px-5 text-right">Decision / Action Board</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No submitted staff reimbursement cards matched these values.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-55/10">
                    {/* Employee info capsule */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 leading-tight">{exp.employeeName}</div>
                      <div className="text-[9.5px] font-bold font-mono text-slate-450 uppercase">{exp.employeeId}</div>
                    </td>

                    {/* Claims creation date */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-550 whitespace-nowrap">
                      {exp.date}
                    </td>

                    {/* Expense category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[#4f46e5] font-black text-[9px]">
                        {exp.expenseType}
                      </span>
                    </td>

                    {/* Attach slip file */}
                    <td className="py-3.5 px-4 text-center">
                      {exp.receiptUrl ? (
                        <button
                          onClick={() => setSelectedReceipt(exp.receiptUrl || null)}
                          className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:text-indigo-850 p-1 bg-indigo-50 border border-indigo-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Doc</span>
                        </button>
                      ) : (
                        <span className="text-[10.5px] italic text-slate-400 font-mono">None</span>
                      )}
                    </td>

                    {/* Editable amount claimed */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {editingExpenseId === exp.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editedAmount}
                            onChange={(e) => setEditedAmount(e.target.value)}
                            className="w-18 px-1.5 py-1 border border-indigo-300 rounded font-mono text-right text-2xs focus:outline-none"
                          />
                          <button
                            onClick={() => saveEditedAmount(exp.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-200 bg-white cursor-pointer"
                            title="Save adjusted claim amount"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingExpenseId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-50 border border-slate-200 rounded bg-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 group">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            ₹{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                          </span>
                          <button
                            onClick={() => startEditAmount(exp)}
                            className="p-1 text-slate-400 hover:text-indigo-650 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-slate-100 cursor-pointer"
                            title="Adjust or edit claim amount"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Log description remark */}
                    <td className="py-3.5 px-4 max-w-xs break-words font-sans text-slate-600">
                      <div>{exp.remark}</div>
                      
                      {/* Admin comment section */}
                      {adminRemarkExpenseId === exp.id ? (
                        <div className="mt-2 flex gap-1.5 items-center">
                          <input
                            type="text"
                            placeholder="Add accounting comment..."
                            value={adminRemarkText}
                            onChange={(e) => setAdminRemarkText(e.target.value)}
                            className="flex-1 px-2 py-1 border border-indigo-200 rounded focus:outline-none font-sans"
                          />
                          <button
                            onClick={() => saveAdminRemark(exp.id)}
                            className="px-2 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-750 whitespace-nowrap cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setAdminRemarkExpenseId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1.5 group/rem">
                          {exp.adminRemark ? (
                            <p className="text-[10px] text-indigo-600 font-bold border-l-2 border-indigo-300 pl-1.5 leading-snug">
                              Admin: {exp.adminRemark}
                            </p>
                          ) : (
                            <span className="text-[9.5px] italic text-slate-400">No finance memo</span>
                          )}
                          <button
                            onClick={() => startAddRemark(exp)}
                            className="text-[9px] text-[#4f46e5] font-semibold opacity-0 group-hover/rem:opacity-100 hover:underline cursor-pointer"
                          >
                            {exp.adminRemark ? '[Edit Memo]' : '[Add Memo]'}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Color status badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                        exp.status === 'Approved' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : exp.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {exp.status === 'Approved' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                        {exp.status === 'Rejected' && <XCircle className="w-3 h-3 text-rose-500" />}
                        {exp.status === 'Pending' && <AlertCircle className="w-3 h-3 text-amber-500" />}
                        <span>{exp.status}</span>
                      </span>
                    </td>

                    {/* Admin review decision action items */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap font-sans font-bold">
                      {exp.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDecideExpense(exp.id, 'Approved')}
                            className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-750 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDecideExpense(exp.id, 'Rejected')}
                            className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-750 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDecideExpense(exp.id, 'Pending')}
                          className="text-[#4f46e5] text-[10px] hover:underline cursor-pointer"
                          title="Undo decision, set to Pending"
                        >
                          Revert to Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* zoom modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full border border-slate-150 shadow-2xl flex flex-col animate-scaleIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between text-slate-900 bg-slate-50/50">
              <span className="text-xs font-bold font-mono">Reimbursement Receipt slip Zoom</span>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-450 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-905 flex justify-center items-center max-h-[70vh] overflow-y-auto bg-[#1e293b]">
              <img 
                src={selectedReceipt} 
                alt="Zoomed details" 
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-slate-705"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
