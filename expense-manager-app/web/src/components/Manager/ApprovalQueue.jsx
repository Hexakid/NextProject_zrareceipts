import { useState, useEffect } from 'react';
import { approvalsApi } from '../../services/api';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function ApprovalQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await approvalsApi.queue(); setQueue(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDecision = async (expenseId, action) => {
    if (action === 'reject' && !comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setProcessing(true);
    try {
      if (action === 'approve') {
        await approvalsApi.approve(expenseId, { comments: comment });
      } else {
        await approvalsApi.reject(expenseId, { comments: comment });
      }
      setSelected(null);
      setComment('');
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    } finally { setProcessing(false); }
  };

  const categoryLabel = (name) => name?.replace(/_/g, ' ') || '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Approval Queue</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {queue.length} pending {queue.length === 1 ? 'request' : 'requests'}
          </p>
        </div>
        <span className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 text-sm font-medium px-3 py-1.5 rounded-full">
          <Clock className="w-4 h-4" /> {queue.length} pending
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-gray-600">All caught up!</p>
          <p className="text-sm mt-1">No expenses waiting for your review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((approval) => {
            const e = approval.Expense;
            const isSelected = selected === approval.id;
            return (
              <div key={approval.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">
                          {approval.requestedBy?.username || '—'}
                        </span>
                        <span className="text-gray-400 text-xs">·</span>
                        <span className="text-xs text-gray-500 capitalize">{categoryLabel(e?.Category?.name)}</span>
                      </div>
                      <p className="text-gray-700 text-sm mb-1">{e?.description}</p>
                      {e?.merchantName && (
                        <p className="text-xs text-gray-400">{e.merchantName}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>📅 {e?.expenseDate ? format(new Date(e.expenseDate), 'dd MMM yyyy') : '—'}</span>
                        <span>📁 {e?.Project?.name || '—'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900">ZWL {parseFloat(e?.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted {e?.submissionDate ? format(new Date(e.submissionDate), 'dd MMM') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setSelected(isSelected ? null : approval.id); setComment(''); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-600"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {isSelected ? 'Cancel' : 'Review'}
                    </button>
                    <button
                      onClick={() => handleDecision(e?.id, 'approve')}
                      disabled={processing}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => setSelected(isSelected ? null : `reject-${approval.id}`)}
                      disabled={processing}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium border border-red-200 transition disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>

                {/* Rejection form */}
                {selected === `reject-${approval.id}` && (
                  <div className="border-t border-red-100 bg-red-50 p-4">
                    <label className="block text-xs font-medium text-red-700 mb-1">
                      Rejection reason (required)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      placeholder="Explain why this expense is being rejected…"
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleDecision(e?.id, 'reject')}
                        disabled={processing || !comment.trim()}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => { setSelected(null); setComment(''); }}
                        className="text-xs text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
