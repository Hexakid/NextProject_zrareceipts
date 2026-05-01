import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { reportsApi, budgetsApi } from '../../services/api';
import { TrendingUp, AlertTriangle, DollarSign, Clock, Download } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function StatCard({ icon: Icon, title, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600'
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function FinanceDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      reportsApi.analytics(),
      budgetsApi.alerts()
    ]).then(([aRes, alertRes]) => {
      setAnalytics(aRes.data);
      setAlerts(alertRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await reportsApi.exportCsv({});
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setExporting(false); }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await reportsApi.exportPdf({});
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `expense-report-${new Date().toISOString().slice(0, 10)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setExporting(false); }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading dashboard…</div>;

  const approvedTotal = analytics?.byStatus?.find(s => s.status === 'approved')?.total || 0;
  const pendingCount = analytics?.pendingApprovals || 0;
  const byCategory = analytics?.byCategory || [];
  const topProjects = analytics?.topProjects || [];
  const monthly = analytics?.monthlyTrend || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Finance Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Budget vs actual tracking across all projects</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> PDF Report
          </button>
        </div>
      </div>

      {/* Budget alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.projectId} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              a.level === 'exceeded' ? 'bg-red-50 border-red-200 text-red-800' :
              a.level === 'critical' ? 'bg-orange-50 border-orange-200 text-orange-800' :
              'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>{a.projectName}</strong>: {a.burnRatePct}% of budget used 
                (ZWL {parseFloat(a.spent).toFixed(0)} / {parseFloat(a.budget).toFixed(0)})
                {a.level === 'exceeded' && ' — BUDGET EXCEEDED'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Total Approved" value={`ZWL ${parseFloat(approvedTotal).toFixed(0)}`} color="green" />
        <StatCard icon={Clock} title="Pending Approval" value={pendingCount} color="yellow" />
        <StatCard icon={TrendingUp} title="Projects Over 80%" value={alerts.length} color={alerts.length > 0 ? 'red' : 'brand'} />
        <StatCard icon={AlertTriangle} title="Budget Alerts" value={alerts.filter(a => a.level === 'exceeded').length} sub="projects exceeded budget" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Spending Trend</h3>
          {monthly.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short' })} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`ZWL ${parseFloat(v).toFixed(2)}`, 'Spent']} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Spending by Category</h3>
          {byCategory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byCategory} dataKey="total" nameKey="categoryName" outerRadius={80} label={({ categoryName, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `ZWL ${parseFloat(v).toFixed(2)}`} />
                <Legend formatter={v => v?.replace(/_/g, ' ')} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Projects budget vs actual */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Project Budget vs Actual Spend</h3>
        {topProjects.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No project data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProjects}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="projectName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `ZWL ${parseFloat(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#dbeafe" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spent" name="Spent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
