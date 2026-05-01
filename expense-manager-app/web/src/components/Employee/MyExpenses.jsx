import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { expensesApi } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import { Plus, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function MyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await expensesApi.list(params);
      setExpenses(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = expenses.filter(e =>
    !search ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.merchantName?.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Expenses</h2>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} expense{filtered.length !== 1 ? 's' : ''} · ZWL {total.toFixed(2)} total</p>
        </div>
        <Link
          to="/employee/submit"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> New Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No expenses yet</p>
            <Link to="/employee/submit" className="text-brand-600 hover:underline text-sm">Submit your first expense →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {format(new Date(e.expenseDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{e.description}</p>
                    {e.merchantName && <p className="text-xs text-gray-400">{e.merchantName}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.Project?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{e.Category?.name?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">ZWL {parseFloat(e.amount).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3">
                    {['draft', 'rejected'].includes(e.status) && (
                      <Link to={`/employee/edit/${e.id}`} className="text-brand-600 hover:underline text-xs">Edit</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
