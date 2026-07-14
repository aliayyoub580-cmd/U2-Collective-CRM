import React, { useState, useEffect } from 'react';
import { User, Users, Plus, Edit, Trash2, Shield, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormSelect, PrimaryButton, SecondaryButton } from '../components/FormFields';
import StatusBadge from '../components/StatusBadge';

const ROLES = ['CEO', 'Manager', 'Sales Representative', 'Marketing', 'Accountant', 'Employee'];
const initialUserForm = { name: '', email: '', password: '', role: 'Employee', employee_type: '', status: 'active' };

export default function SettingsPage() {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', current_password: '', new_password: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userErrors, setUserErrors] = useState({});
  const [userNotice, setUserNotice] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);

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

  const openCreateUser = () => { setUserForm(initialUserForm); setUserErrors({}); setShowUserPassword(false); setEditUser(null); setShowUserModal(true); };
  const openEditUser = (u) => { setUserForm({ name: u.name, email: u.email, password: '', role: u.role, employee_type: u.employee_type || '', status: u.status }); setUserErrors({}); setShowUserPassword(false); setEditUser(u); setShowUserModal(true); };

  const PasswordInput = ({ label, value, onChange, visible, onToggle, required = false, placeholder }) => (
    <div style={{ position: 'relative' }}>
      <FormInput label={label} type={visible ? 'text' : 'password'} required={required} value={value} onChange={onChange} placeholder={placeholder} />
      <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} title={visible ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '12px', bottom: '11px', border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer', padding: '2px' }}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (userForm.role === 'Employee' && !userForm.employee_type) {
      setUserErrors({ employee_type: 'Select an employee type for this Employee account.' });
      return;
    }
    setSavingUser(true);
    setUserErrors({});
    try {
      const payload = { ...userForm, employee_type: userForm.role === 'Employee' ? userForm.employee_type : null };
      if (editUser) await api.put(`/users/${editUser.id}`, payload);
      else await api.post('/users', payload);
      setShowUserModal(false);
      setUserForm(initialUserForm);
      setUserNotice(editUser ? 'User updated successfully.' : 'User created successfully.');
      api.get('/users').then(r => setUsers(r.data.users || []));
    } catch (err) {
      setUserErrors({ general: err.response?.data?.error || 'Unable to save this user.' });
    } finally { setSavingUser(false); }
  };

  const handleDeleteUser = async () => {
    try { await api.delete(`/users/${deleteUserId}`); setUserNotice('User deactivated successfully.'); api.get('/users').then(r => setUsers(r.data.users || [])); } catch (err) { setUserNotice(err.response?.data?.error || 'Unable to deactivate this user.'); }
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
              {user?.employee_type && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '700', background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '999px' }}>{user.employee_type === 'lead_generator' ? 'Lead Generator' : 'Caller'}</span>}
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
                  <PasswordInput label="Current Password" visible={showCurrentPassword} onToggle={() => setShowCurrentPassword(value => !value)} value={profileForm.current_password} onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })} />
                  <PasswordInput label="New Password" visible={showNewPassword} onToggle={() => setShowNewPassword(value => !value)} value={profileForm.new_password} onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} />
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
          {userNotice && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '13px', fontWeight: '600' }}>{userNotice}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <PrimaryButton onClick={openCreateUser} icon={Plus}>Add User</PrimaryButton>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['User', 'Role', 'Employee Type', 'Status', 'Created', 'Actions'].map(h => (
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
                    <td style={{ padding: '14px 16px' }}><span style={{ fontSize: '11px', fontWeight: '700', background: u.employee_type ? '#EDE9FE' : '#F1F5F9', color: u.employee_type ? '#6D28D9' : '#64748B', padding: '4px 9px', borderRadius: '999px' }}>{u.employee_type === 'lead_generator' ? 'Lead Generator' : u.employee_type === 'caller' ? 'Caller' : 'Not Assigned'}</span></td>
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
          {userErrors.general && <div style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>{userErrors.general}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Full Name" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <FormInput label="Email" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <PasswordInput
              label={editUser ? 'New Password (optional)' : 'Password'}
              required={!editUser}
              visible={showUserPassword}
              onToggle={() => setShowUserPassword(value => !value)}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder={editUser ? 'Leave blank to keep current password' : undefined}
            />
            <FormSelect label="Role" value={userForm.role} onChange={(e) => { const role = e.target.value; setUserForm({ ...userForm, role, employee_type: role === 'Employee' ? userForm.employee_type : '' }); setUserErrors({ ...userErrors, employee_type: undefined }); }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </FormSelect>
            {userForm.role === 'Employee' && (
              <FormSelect label="Employee Type" required value={userForm.employee_type} error={userErrors.employee_type} onChange={(e) => setUserForm({ ...userForm, employee_type: e.target.value })}>
                <option value="">Select employee type</option>
                <option value="lead_generator">Lead Generator</option>
                <option value="caller">Caller</option>
              </FormSelect>
            )}
            <FormSelect label="Status" value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FormSelect>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', position: 'sticky', bottom: 0, background: '#FFFFFF', paddingTop: '12px' }}>
            <SecondaryButton onClick={() => setShowUserModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={savingUser}>{editUser ? 'Update' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteUserId} onClose={() => setDeleteUserId(null)} onConfirm={handleDeleteUser} title="Deactivate User" message="Deactivate this user account?" confirmLabel="Deactivate" />
    </div>
  );
}
