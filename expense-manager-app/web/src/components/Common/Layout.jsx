import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import NotificationBell from './NotificationBell';
import {
  ReceiptText, LayoutDashboard, CheckSquare,
  FolderKanban, BarChart3, LogOut, ChevronRight, User
} from 'lucide-react';

const navByRole = {
  employee: [
    { to: '/employee', label: 'My Expenses', icon: ReceiptText, end: true },
    { to: '/employee/submit', label: 'Submit Expense', icon: CheckSquare }
  ],
  manager: [
    { to: '/manager', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/manager/approvals', label: 'Approvals', icon: CheckSquare },
    { to: '/manager/team', label: 'Team Expenses', icon: FolderKanban }
  ],
  finance_admin: [
    { to: '/finance', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/finance/projects', label: 'Projects', icon: FolderKanban },
    { to: '/finance/budgets', label: 'Budgets', icon: BarChart3 },
    { to: '/finance/reports', label: 'Reports', icon: ReceiptText }
  ]
};

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = navByRole[user?.role] || [];

  const roleColors = {
    employee: 'bg-green-100 text-green-700',
    manager: 'bg-blue-100 text-blue-700',
    finance_admin: 'bg-purple-100 text-purple-700'
  };
  const roleLabel = { employee: 'Employee', manager: 'Manager', finance_admin: 'Finance Admin' };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-tight">ExpenseManager</h1>
              <p className="text-xs text-gray-400">Business Edition</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[user?.role]}`}>
                {roleLabel[user?.role]}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div />
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-sm text-gray-500">
              Welcome, <span className="font-medium text-gray-800">{user?.username}</span>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
