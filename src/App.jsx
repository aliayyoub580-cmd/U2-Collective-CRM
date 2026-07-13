import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import LeadsPage from './pages/LeadsPage';
import ManagerLeadsPage from './pages/ManagerLeadsPage';
import AdminCompletedLeadsPage from './pages/AdminCompletedLeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import FollowUpsPage from './pages/FollowUpsPage';
import CommunicationsPage from './pages/CommunicationsPage';
import TasksPage from './pages/TasksPage';
import CallerTasksPage from './pages/CallerTasksPage';
import ProposalsPage from './pages/ProposalsPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import EmployeesPage from './pages/EmployeesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

function PrivateRoute({ children, module }) {
  const { user, loading, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748B] text-sm font-medium">Loading U2 CRM...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (module && !canAccess(module)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Lock size={26} />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Access Restricted</h2>
            <p className="text-[#64748B]">You don't have permission to access this module.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <PrivateRoute module="dashboard"><Dashboard /></PrivateRoute>
      } />
      <Route path="/leads" element={
        <PrivateRoute module="leads">{user?.role === 'Manager' ? <ManagerLeadsPage /> : <LeadsPage />}</PrivateRoute>
      } />
      <Route path="/leads/:id" element={
        <PrivateRoute module="leads"><LeadDetailPage /></PrivateRoute>
      } />
      <Route path="/completed-leads" element={
        <PrivateRoute module="completed_leads"><AdminCompletedLeadsPage /></PrivateRoute>
      } />
      <Route path="/follow-ups" element={
        <PrivateRoute module="followups"><FollowUpsPage /></PrivateRoute>
      } />
      <Route path="/communications" element={
        <PrivateRoute module="communications"><CommunicationsPage /></PrivateRoute>
      } />
      <Route path="/tasks" element={
        <PrivateRoute module="tasks">{user?.employee_type === 'caller' ? <CallerTasksPage /> : <TasksPage />}</PrivateRoute>
      } />
      <Route path="/proposals" element={
        <PrivateRoute module="proposals"><ProposalsPage /></PrivateRoute>
      } />
      <Route path="/clients" element={
        <PrivateRoute module="clients"><ClientsPage /></PrivateRoute>
      } />
      <Route path="/clients/:id" element={
        <PrivateRoute module="clients"><ClientDetailPage /></PrivateRoute>
      } />
      <Route path="/employees" element={
        <PrivateRoute module="employees"><EmployeesPage /></PrivateRoute>
      } />
      <Route path="/reports" element={
        <PrivateRoute module="reports"><ReportsPage /></PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute module="profile"><SettingsPage /></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
