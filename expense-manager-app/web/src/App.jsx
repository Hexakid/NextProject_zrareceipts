import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import LoginPage from './pages/LoginPage';
import Layout from './components/Common/Layout';
import MyExpenses from './components/Employee/MyExpenses';
import ExpenseForm from './components/Employee/ExpenseForm';
import ApprovalQueue from './components/Manager/ApprovalQueue';
import TeamExpenses from './components/Manager/TeamExpenses';
import FinanceDashboard from './components/Finance/FinanceDashboard';

const queryClient = new QueryClient();

function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated, loading } = useAuthStore();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/login" replace />;
  return children;
}

function EmployeePages() {
  return (
    <Layout>
      <Routes>
        <Route index element={<MyExpenses />} />
        <Route path="submit" element={
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Submit New Expense</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ExpenseForm />
            </div>
          </div>
        } />
      </Routes>
    </Layout>
  );
}

function ManagerPages() {
  return (
    <Layout>
      <Routes>
        <Route index element={<ApprovalQueue />} />
        <Route path="approvals" element={<ApprovalQueue />} />
        <Route path="team" element={<TeamExpenses />} />
      </Routes>
    </Layout>
  );
}

function FinancePages() {
  return (
    <Layout>
      <Routes>
        <Route index element={<FinanceDashboard />} />
        <Route path="budgets" element={<FinanceDashboard />} />
        <Route path="projects" element={<FinanceDashboard />} />
        <Route path="reports" element={<FinanceDashboard />} />
      </Routes>
    </Layout>
  );
}

function AppInner() {
  const { loadCurrentUser, user } = useAuthStore();
  useEffect(() => { loadCurrentUser(); }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/employee/*" element={
        <ProtectedRoute roles={['employee', 'manager', 'finance_admin']}>
          <EmployeePages />
        </ProtectedRoute>
      } />
      <Route path="/manager/*" element={
        <ProtectedRoute roles={['manager', 'finance_admin']}>
          <ManagerPages />
        </ProtectedRoute>
      } />
      <Route path="/finance/*" element={
        <ProtectedRoute roles={['finance_admin']}>
          <FinancePages />
        </ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'finance_admin' ? <Navigate to="/finance" replace /> :
           user?.role === 'manager' ? <Navigate to="/manager" replace /> :
           <Navigate to="/employee" replace />}
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
