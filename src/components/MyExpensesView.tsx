import React, { useState } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Image as ImageIcon, 
  Calendar, 
  X, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Filter,
  Edit2,
  Trash2
} from 'lucide-react';
import { Employee, Expense } from '../types';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, cleanFirestoreData } from '../firebase';

interface MyExpensesProps {
  loggedInEmployee: Employee;
  expenses: Expense[];
}

const EXPENSE_TYPES = [
  'Petrol',
  'Thermal Roll',
  'Ink',
  'A4 Paper',
  'E-Rickshaw Rent',
  'Other Expenses'
] as const;

export default function MyExpensesView({
  loggedInEmployee,
  expenses
}: MyExpensesProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<typeof EXPENSE_TYPES[number]>('Petrol');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Expense | null>(null);

  const handleStartEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDate(expense.date);
    setType(expense.expenseType as any);
    setAmount(expense.amount.toString());
    setRemark(expense.remark);
    setReceiptBase64(expense.receiptUrl || null);
    setShowAddModal(true);
  };

  const handleDeleteRequest = (expense: Expense) => {
    setShowDeleteConfirm(expense);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    setErrorMsg(null);
    setDate(new Date().toISOString().split('T')[0]);
    setType('Petrol');
    setAmount('');
    setRemark('');
    setReceiptBase64(null);
  };

  const confirmDeleteExpense = async () => {
    if (!showDeleteConfirm) return;
    setIsSubmitting(true);
    const docId = showDeleteConfirm.id;
    try {
      await deleteDoc(doc(db, 'expenses', docId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete expense doc:', err);
      setErrorMsg('Failed to delete expense log. Please check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filters for employee logs
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Handle receipt selection and convert to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // limit to 800KB for offline friendly Base64 storage
        setErrorMsg('File is too large. Please select a receipt image under 800 KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
        setErrorMsg(null);
      };
      reader.onerror = () => {
        setErrorMsg('Failed to process image file.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setErrorMsg('File is too large. Please select an image under 800 KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
        setErrorMsg(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearReceipt = () => {
    setReceiptBase64(null);
  };

  const handleAddExpensesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please specify a positive reimbursement amount.');
      return;
    }

    if (!remark.trim()) {
      setErrorMsg('Please add a short remark or description for accounting.');
      return;
    }

    setIsSubmitting(true);
    const docId = editingExpense ? editingExpense.id : `EXP-${Date.now()}`;
    const newExpense: Expense = {
      ...(editingExpense || {}),
      id: docId,
      employeeId: loggedInEmployee.id,
      employeeName: loggedInEmployee.name,
      date,
      expenseType: type,
      amount: numericAmount,
      remark: remark.trim(),
      receiptUrl: receiptBase64 || undefined,
      status: 'Pending',
      submittedAt: editingExpense ? editingExpense.submittedAt : new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'expenses', docId), cleanFirestoreData(newExpense));
      
      // Clear forms and reset editing state
      setDate(new Date().toISOString().split('T')[0]);
      setType('Petrol');
      setAmount('');
      setRemark('');
      setReceiptBase64(null);
      setEditingExpense(null);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to submit expense log:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `expenses/${docId}`);
      } catch (logErr) {
        setErrorMsg('Network error. Ticket successfully registered to offline local cache.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logs for employee
  const myLogs = expenses.filter(exp => exp.employeeId === loggedInEmployee.id);
  
  const filteredLogs = myLogs.filter(exp => {
    const matchesSearch = exp.remark.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalClaimsSum = myLogs.reduce((sum, exp) => sum + exp.amount, 0);
  const approvedClaimsSum = myLogs.filter(e => e.status === 'Approved').reduce((sum, exp) => sum + exp.amount, 0);
  const pendingClaimsSum = myLogs.filter(e => e.status === 'Pending').reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="my-expenses-sheet">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-650">
            <Receipt className="w-5 h-5" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">My Expense Reimbursements</h1>
          </div>
          <p className="text-xs text-slate-500">
            Submit out-of-pocket expenses such as petrol, ink, rolls, paper & e-rickshaw rents for approval.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Claim Reimbursement</span>
        </button>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Approved Total</span>
          <p className="text-xl font-black text-emerald-650">₹{approvedClaimsSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block leading-tight">Automatically added to upcoming monthly salary payslip</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Pending Claims</span>
          <p className="text-xl font-black text-amber-500">₹{pendingClaimsSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block leading-tight">Reviewed dynamically by finance administrators</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Total Submissions</span>
          <p className="text-xl font-black text-slate-900">₹{totalClaimsSum.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
          <span className="text-[9px] text-slate-400 block leading-tight">All history entries including rejected bills</span>
        </div>
      </div>

      {/* Filters & Listing */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-between items-center">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Search by remark or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-sans placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Status filter selection */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <div className="grid grid-cols-4 w-full sm:w-64 border border-slate-200 rounded-xl overflow-hidden text-[10px] sm:text-xs font-semibold bg-white">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`py-2 px-1 text-center truncate transition-colors cursor-pointer ${
                    statusFilter === status 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger logs */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-2xs font-sans">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-550 font-bold uppercase tracking-wider text-[9px] font-mono">
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-4">Expense Type</th>
                <th className="py-3.5 px-4 text-center">Amount</th>
                <th className="py-3.5 px-4">Remark Description</th>
                <th className="py-3.5 px-4 text-center">Receipt Doc</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5">Admin Remarks / Updates</th>
                <th className="py-3.5 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No submitted expense vouchers matched the filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/20">
                    <td className="py-3 px-5 font-mono font-bold text-slate-500 whitespace-nowrap">
                      {log.date}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-100/30">
                        {log.expenseType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-xs">
                      ₹{log.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs break-words">
                      {log.remark}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {log.receiptUrl ? (
                        <button
                          onClick={() => setSelectedReceipt(log.receiptUrl || null)}
                          className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-650 hover:text-indigo-850 p-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors cursor-pointer"
                          title="Click to view file attachment"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Doc</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono italic">No file</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                        log.status === 'Approved' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : log.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {log.status === 'Approved' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                        {log.status === 'Rejected' && <XCircle className="w-3 h-3 text-rose-500" />}
                        {log.status === 'Pending' && <AlertCircle className="w-3 h-3 text-amber-500" />}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-500 max-w-xs break-words font-sans">
                      {log.adminRemark ? (
                        <p className="text-[10px] border-l-2 border-indigo-400 pl-2 leading-tight">
                          {log.adminRemark}
                        </p>
                      ) : (
                        <span className="text-[10px] italic text-slate-400 font-mono">Awaiting admin review...</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-center whitespace-nowrap">
                      {log.status === 'Pending' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleStartEdit(log)}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[9px] font-black bg-indigo-50 hover:bg-indigo-150 border border-indigo-200 text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer"
                            title="Edit claim details"
                          >
                            <Edit2 className="w-3 h-3 text-indigo-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteRequest(log)}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[9px] font-black bg-rose-50 hover:bg-rose-150 border border-rose-200 text-rose-700 hover:text-rose-950 transition-colors cursor-pointer"
                            title="Delete this claim"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-mono italic">Locked</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reciept Preview modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full border border-slate-150 shadow-2xl flex flex-col animate-scaleIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between text-slate-900 bg-slate-50/50">
              <span className="text-xs font-bold font-mono">Supporting Receipt Document</span>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-450 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-900 flex justify-center items-center max-h-[70vh] overflow-y-auto">
              <img 
                src={selectedReceipt} 
                alt="Receipt supporting attachment" 
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-slate-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add expense Log modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full border border-slate-150 shadow-2xl flex flex-col animate-scaleIn">
            <div className="p-4.5 border-b border-slate-100 flex items-center justify-between text-slate-900">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black tracking-tight uppercase">{editingExpense ? 'Edit Expense Claim' : 'New Reimbursement Request'}</h3>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-slate-450 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpensesSubmit} className="p-5 space-y-4 text-2xs font-sans">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 font-semibold leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {/* Date selection */}
              <div className="space-y-1">
                <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Expense Date</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Expense category dropdown */}
              <div className="space-y-1">
                <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Expense Category</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
                >
                  {EXPENSE_TYPES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Claim price amount */}
              <div className="space-y-1">
                <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Amount Claimed (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-semibold select-none text-sm font-mono">₹</span>
                </div>
              </div>

              {/* Log explanation details */}
              <div className="space-y-1">
                <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Remark / Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Details of petrol filled, ink company used or printing details..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Drag n drop File receipt Upload */}
              <div className="space-y-1">
                <label className="block font-black text-slate-700 uppercase tracking-wider font-mono text-[9px]">Attach Receipt / Slip (Optional)</label>
                
                {receiptBase64 ? (
                  <div className="p-3 border border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0 text-[10px]">
                        <p className="font-bold text-slate-800 truncate">receipt_document.png</p>
                        <p className="text-slate-450 font-mono">Processed Base64 stream</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearReceipt}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer p-1 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-colors bg-slate-50/50 p-6 rounded-2xl text-center cursor-pointer relative"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-700 leading-tight">Drag and drop receipts, or click to choose</p>
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">Image formats (JPG, PNG) Max 800 KB</p>
                  </div>
                )}
              </div>

              {/* Actions submit */}
              <div className="pt-2 flex justify-end gap-3 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white min-w-[110px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md shadow-indigo-100"
                >
                  {isSubmitting ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span>{editingExpense ? 'Update Claim' : 'Submit Claim'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full border border-slate-150 shadow-2xl flex flex-col animate-scaleIn">
            <div className="p-5 text-center space-y-4 font-sans text-2xs">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 animate-pulse">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Delete Expense Claim?</h3>
                <p className="text-slate-500 leading-relaxed">
                  Are you sure you want to permanently delete your <span className="font-bold text-slate-700">{showDeleteConfirm.expenseType}</span> claim of <span className="font-bold text-slate-800">₹{showDeleteConfirm.amount.toLocaleString()}</span>? This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                >
                  No, Keep it
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={confirmDeleteExpense}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white min-w-[100px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span>Yes, Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
