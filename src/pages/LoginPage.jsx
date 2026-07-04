import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@u2collective.com', password: 'admin123' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getErrorMessage = (err) => {
    const data = err.response?.data;
    const message = data?.error || data?.message || err.message;
    if (typeof message === 'string') return message;
    if (typeof data === 'string') return data;
    if (err.response?.status === 404) {
      return 'Login API was not found. Please redeploy with the Vercel API configuration.';
    }
    return 'Login failed. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.05,
        backgroundImage: 'radial-gradient(circle at 25% 25%, #2563EB 0%, transparent 50%), radial-gradient(circle at 75% 75%, #7C3AED 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      <div className="animate-fade-in" style={{
        width: '100%', maxWidth: '420px',
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 32px 100px rgba(0,0,0,0.4)'
      }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{
            width: '72px', height: '72px',
            background: '#FFFFFF',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 30px rgba(15,23,42,0.12)'
          }}>
            <img
              src={`${import.meta.env.BASE_URL}U2%20Collective%20Logo.png`}
              alt="U2 Collective"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
            U2 Collective LLP
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>CRM Management System</p>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: '12px', padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                  style={{
                    width: '100%', height: '48px',
                    border: '1px solid #CBD5E1', borderRadius: '12px',
                    paddingLeft: '40px', paddingRight: '14px',
                    fontSize: '14px', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%', height: '48px',
                    border: '1px solid #CBD5E1', borderRadius: '12px',
                    paddingLeft: '40px', paddingRight: '44px',
                    fontSize: '14px', outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: '48px',
                background: loading ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '14px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px',
                transition: 'background 0.15s'
              }}
            >
              {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Default Credentials:</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>Email: admin@u2collective.com</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>Password: admin123</p>
        </div>
      </div>
    </div>
  );
}
