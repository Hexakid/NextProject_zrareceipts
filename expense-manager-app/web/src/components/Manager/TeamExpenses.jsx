import { useEffect, useState } from 'react';
import { expensesApi } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import { format } from 'date-fns';

export default function TeamExpenses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await expensesApi.team();
        setItems(data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-5">Team Expenses</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No team expenses found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{format(new Date(e.expenseDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-gray-700">{e.submitter?.username || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600">{e.Project?.name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">ZWL {parseFloat(e.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
