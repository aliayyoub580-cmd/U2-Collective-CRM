import React, { useState, useEffect } from 'react';
import { Settings, User, Users, Plus, Edit, Trash2, Shield } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormSelect, PrimaryButton, SecondaryButton } from '../components/FormFields';
import StatusBadge from '../components/StatusBadge';

const ROLES = ['CEO', 'Manager', 'Sales Representative', 'Marketing', 'Accountant', 'Employee'];

export default function SettingsPage() {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', current_password: '', new_password: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Employee', status: 'active' });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (hasRole('CEO') && activeTab === 'users') {
      api.get('/users').then(r => setUsers(r.data.users || [])).catch(() => {});
    }
  }, [activeTab]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    try {
      await api.put('/users/profile/me', profileForm);
      setProfileMsg('Profile updated successfully!');
      setProfileForm({ ...profileForm, current_password: '', new_password: '' });
    } catch (err) {
      setProfileMsg(err.response?.data?.error || 'Update failed');
    } finally { setProfileSaving(false); }
  };

  const openCreateUser = () => { setUserForm({ name: '', email: '', password: '', role: 'Employee', status: 'active' }); setEditUser(null); setShowUserModal(true); };
  const openEditUser = (u) => { setUserForm({ name: u.name, email: u.email, password: '', role: u.role, status: u.status }); setEditUser(u); setShowUserModal(true); };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editUser) await api.put(`/users/${editUser.id}`, userForm);
      else await api.post('/users', userForm);
      setShowUserModal(false);
      api.get('/users').then(r => setUsers(r.data.users || []));
    } catch (err) {
      console.error(err);
    } finally { setSavingUser(false); }
  };

  const handleDeleteUser = async () => {
    try { await api.delete(`/users/${deleteUserId}`); api.get('/users').then(r => setUsers(r.data.users || [])); } catch (err) {}
    setDeleteUserId(null);
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    ...(hasRole('CEO') ? [{ id: 'users', label: 'User Management', icon: Users }] : []),
    { id: 'about', label: 'About', icon: Shield },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and system preferences" />

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
                border: `1px solid ${activeTab === t.id ? '#2563EB' : '#E2E8F0'}`,
                background: activeTab === t.id ? '#2563EB' : '#FFFFFF',
                color: activeTab === t.id ? '#FFFFFF' : '#475569',
                cursor: 'pointer'
              }}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '28px', maxWidth: '520px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF' }}>{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>{user?.name}</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>{user?.email}</p>
              <span style={{ fontSize: '11px', fontWeight: '600', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px' }}>{user?.role}</span>
            </div>
          </div>

          {profileMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: profileMsg.includes('success') ? '#DCFCE7' : '#FEF2F2', border: `1px solid ${profileMsg.includes('success') ? '#BBF7D0' : '#FECACA'}` }}>
              <p style={{ fontSize: '13px', color: profileMsg.includes('success') ? '#15803D' : '#DC2626', fontWeight: '500' }}>{profileMsg}</p>
            </div>
          )}

          <form onSubmit={handleProfileSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormInput label="Full Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '4px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>Change Password (optional)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FormInput label="Current Password" type="password" value={profileForm.current_password} onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })} />
                  <FormInput label="New Password" type="password" value={profileForm.new_password} onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} />
                </div>
              </div>
              <PrimaryButton type="submit" loading={profileSaving}>Save Changes</PrimaryButton>
            </div>
          </form>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && hasRole('CEO') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <PrimaryButton onClick={openCreateUser} icon={Plus}>Add User</PrimaryButton>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['User', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #E2E8F0' }} className="hover:bg-[#F8FAFC]">
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB' }}>{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>{u.name}</p>
                          <p style={{ fontSize: '12px', color: '#64748B' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{u.role}</td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge status={u.status === 'active' ? 'Active' : 'Inactive'} /></td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEditUser(u)} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569]"><Edit size={14} /></button>
                        {u.id !== user?.id && (
                          <button onClick={() => setDeleteUserId(u.id)} className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626]"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '28px', maxWidth: '520px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Shield size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>U2 Collective LLP CRM</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Version 1.0.0</p>
          </div>
          {[
            ['Company', 'U2 Collective LLP'],
            ['Application', 'CRM Desktop Software'],
            ['Technology', 'React · Node.js · SQLite · Electron'],
            ['Database', 'SQLite (Local Storage)'],
            ['Platform', 'Windows Desktop'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', width: '100px', textTransform: 'uppercase' }}>{l}</span>
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* User modal */}
      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title={editUser ? 'Edit User' : 'Create User'} size="sm">
        <form onSubmit={handleSaveUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Full Name" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <FormInput label="Email" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            {!editUser && <FormInput label="Password" type="password" required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />}
            <FormSelect label="Role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </FormSelect>
            <FormSelect label="Status" value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FormSelect>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <SecondaryButton onClick={() => setShowUserModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={savingUser}>{editUser ? 'Update' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteUserId} onClose={() => setDeleteUserId(null)} onConfirm={handleDeleteUser} title="Deactivate User" message="Deactivate this user account?" confirmLabel="Deactivate" />
    </div>
  );
}
