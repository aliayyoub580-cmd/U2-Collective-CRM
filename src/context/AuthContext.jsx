import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const token = localStorage.getItem('u2crm_token');
    const savedUser = localStorage.getItem('u2crm_user');

    async function restoreSession() {
      if (!token || !savedUser) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        const response = await api.get('/auth/me');
        if (mounted) {
          setUser(response.data.user || parsedUser);
        }
      } catch (err) {
        localStorage.removeItem('u2crm_token');
        localStorage.removeItem('u2crm_user');
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('u2crm_token', token);
    localStorage.setItem('u2crm_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('u2crm_token');
    localStorage.removeItem('u2crm_user');
    setUser(null);
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  const canAccess = (module) => {
    if (!user) return false;
    if (module === 'profile') return true;
    if (user.role === 'CEO') return true;
    if (user.employee_type === 'lead_generator') return ['dashboard', 'leads', 'tasks', 'profile'].includes(module);
    if (user.employee_type === 'caller') return ['dashboard', 'tasks', 'followups', 'profile'].includes(module);
    const permissions = {
      CEO: ['*'],
      Manager: ['dashboard', 'leads', 'followups', 'profile'],
      'Sales Representative': ['dashboard', 'leads', 'followups', 'communications', 'proposals'],
      Marketing: ['dashboard', 'leads', 'reports'],
      Accountant: ['dashboard', 'clients', 'reports'],
      Employee: ['dashboard', 'tasks']
    };

    const userPerms = permissions[user.role] || [];
    return userPerms.includes('*') || userPerms.includes(module);
  };

  const employeeTypeLabel = user?.employee_type === 'lead_generator' ? 'Lead Generator' : user?.employee_type === 'caller' ? 'Caller' : null;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, canAccess, employeeTypeLabel }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
