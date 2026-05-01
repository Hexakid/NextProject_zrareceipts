import { useState, useEffect } from 'react';
import { expensesApi, projectsApi, receiptsApi, categoriesApi } from '../../services/api';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

export default function ExpenseForm({ expense, onSuccess }) {
  const isEdit = !!expense;
  const [form, setForm] = useState({
    projectId: expense?.projectId || '',
    categoryId: expense?.categoryId || '',
    amount: expense?.amount || '',
    expenseDate: expense?.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    description: expense?.description || '',
    merchantName: expense?.merchantName || '',
    isRecurring: expense?.isRecurring || false,
    recurringPattern: expense?.recurringPattern || ''
  });
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploadedReceipt, setUploadedReceipt] = useState(null);
  const [vatReceiptId, setVatReceiptId] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.data)).catch(() => {});
    categoriesApi.list().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const handleFileChange = async (file) => {
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target.result);
    reader.readAsDataURL(file);

    // Auto-OCR on upload
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await receiptsApi.upload(fd);
      const fields = data.extractedFields || {};
      setUploadedReceipt(data.receipt || null);
      setForm(prev => ({
        ...prev,
        merchantName: fields.merchantName || prev.merchantName,
        amount: fields.amountTotal ? parseFloat(fields.amountTotal.replace(/,/g, '')) : prev.amount,
        expenseDate: fields.invoiceDate ? new Date(fields.invoiceDate).toISOString().slice(0, 10) : prev.expenseDate
      }));
      setSuccess('Receipt scanned — fields pre-filled!');
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('OCR failed, please fill fields manually');
      setTimeout(() => setError(''), 4000);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e, submitAfterSave = false) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let savedExpense;
      const payload = {
        ...form,
        receiptId: uploadedReceipt?.id || form.receiptId,
        receiptPath: uploadedReceipt?.imagePath || form.receiptPath
      };
      if (isEdit) {
        const res = await expensesApi.update(expense.id, payload);
        savedExpense = res.data.expense;
      } else {
        const res = await expensesApi.create(payload);
        savedExpense = res.data.expense;
      }
      if (submitAfterSave) {
        await expensesApi.submit(savedExpense.id);
      }
      onSuccess?.();
      setSuccess(submitAfterSave ? 'Expense submitted for approval!' : 'Expense saved as draft.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleImportVatReceipt = async () => {
    if (!vatReceiptId.trim()) return;
    setOcrLoading(true);
    setError('');
    try {
      const { data } = await receiptsApi.importVat({
        vatCollectorReceiptId: vatReceiptId.trim(),
        extractedFields: {},
        imagePath: ''
      });
      if (data?.receipt?.merchantName) {
        setForm((prev) => ({ ...prev, merchantName: data.receipt.merchantName || prev.merchantName }));
      }
      setSuccess('VAT collector receipt linked successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import VAT collector receipt');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <form className="space-y-5">
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Receipt Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Photo</label>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={vatReceiptId}
            onChange={(e) => setVatReceiptId(e.target.value)}
            placeholder="VAT Collector Receipt ID (optional)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleImportVatReceipt}
            className="px-3 py-2 text-sm border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-50"
          >
            Link VAT
          </button>
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center relative">
          {receiptPreview ? (
            <div className="relative inline-block">
              <img src={receiptPreview} alt="Receipt" className="max-h-48 rounded-lg mx-auto" />
              <button
                type="button"
                onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-400 hover:text-brand-600 transition">
              <Upload className="w-8 h-8" />
              <span className="text-sm">{ocrLoading ? 'Scanning receipt…' : 'Upload or take a photo'}</span>
              <span className="text-xs text-gray-300">Fields will be auto-filled via OCR</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files[0])}
              />
            </label>
          )}
          {ocrLoading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
              <div className="text-sm text-brand-600 font-medium animate-pulse">Scanning with OCR…</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Project */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select category…</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZWL) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date *</label>
          <input
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Merchant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Merchant / Supplier</label>
          <input
            type="text"
            value={form.merchantName}
            onChange={(e) => setForm({ ...form, merchantName: e.target.value })}
            placeholder="e.g. Shoprite, Pick n Pay"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            placeholder="Brief description of the expense…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {/* Recurring */}
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              className="w-4 h-4 accent-brand-600"
            />
            <span className="text-sm text-gray-700">Recurring expense</span>
          </label>
        </div>

        {form.isRecurring && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
            <select
              value={form.recurringPattern}
              onChange={(e) => setForm({ ...form, recurringPattern: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select frequency…</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={(e) => handleSubmit(e, false)}
          disabled={saving}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true)}
          disabled={saving}
          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>
    </form>
  );
}
