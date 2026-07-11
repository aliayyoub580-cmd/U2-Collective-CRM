import React, { useState, useEffect, useCallback } from 'react';
import { Plus, UserCog, Trash2, Edit, Search, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const ROLES = ['Manager', 'Sales Representative', 'Marketing', 'Accountant', 'Employee'];
const initialForm = { name: '', role: 'Employee', employee_type: '', salary: '', phone: '', email: '', status: 'Active', joining_date: '', performance_notes: '', password: '' };
const employeeTypeLabel = (value) => value === 'lead_generator' ? 'Lead Generator' : value === 'caller' ? 'Caller' : 'Not Assigned';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/employees', { params: { page, limit: 15, search } });
      setEmployees(res.data.employees);
      setTotal(res.data.total);
    } catch (err) { setLoadError(err.response?.data?.error || 'Unable to load employees.'); } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openCreate = () => { setForm(initialForm); setEditItem(null); setErrors({}); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, role: item.role || 'Employee', employee_type: item.employee_type || '', salary: item.salary || '', phone: item.phone || '', email: item.email || '', status: item.status, joining_date: item.joining_date || '', performance_notes: item.performance_notes || '', password: '' });
    setEditItem(item); setErrors({}); setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.employee_type) e.employee_type = 'Select an employee type.';
    if (!editItem && !form.password) e.password = 'Password is required for a new employee account.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editItem) await api.put(`/employees/${editItem.id}`, form);
      else await api.post('/employees', form);
      setShowModal(false);
      setNotice(editItem ? 'Employee updated successfully.' : 'Employee created successfully.');
      fetchEmployees();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error saving employee';
      setErrors({ general: msg });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/employees/${deleteId}`); setNotice('Employee deactivated successfully.'); fetchEmployees(); } catch (err) { setNotice(err.response?.data?.error || 'Unable to deactivate employee.'); }
    setDeleteId(null);
  };

  const columns = [
    {
      header: 'Employee', key: 'name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#2563EB' }}>{row.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.name}</p>
            <p style={{ fontSize: '12px', color: '#64748B' }}>{row.email}</p>
          </div>
        </div>
      )
    },
    { header: 'Role', render: (row) => <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>{row.role}</span> },
    { header: 'Employee Type', render: (row) => <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '999px', background: row.employee_type ? '#EDE9FE' : '#F1F5F9', color: row.employee_type ? '#6D28D9' : '#64748B', fontSize: '11px', fontWeight: '600' }}>{employeeTypeLabel(row.employee_type)}</span> },
    { header: 'Salary', render: (row) => <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{row.salary ? `$${Number(row.salary).toLocaleString()}` : '—'}</span> },
    { header: 'Phone', render: (row) => <span style={{ fontSize: '13px', color: '#475569' }}>{row.phone || '—'}</span> },
    { header: 'Joined', render: (row) => <span style={{ fontSize: '13px', color: '#475569' }}>{row.joining_date || '—'}</span> },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569]"><Edit size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }} className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626]"><Trash2 size={15} /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Employee Management"
        subtitle={`${total} employees`}
        actions={
          <>
            <button onClick={fetchEmployees} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            <PrimaryButton onClick={openCreate} icon={Plus}>Add Employee</PrimaryButton>
          </>
        }
      />

      {/* Search */}
      {notice && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '13px', fontWeight: '600' }}>{notice}</div>}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px' }}>
        <div className="relative" style={{ maxWidth: '360px' }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input type="text" placeholder="Search employees..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', height: '38px', border: '1px solid #E2E8F0', borderRadius: '10px', paddingLeft: '32px', paddingRight: '12px', fontSize: '13px', background: '#F8FAFC', outline: 'none' }} />
        </div>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        {loadError ? <div style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: '#DC2626', marginBottom: '14px' }}>{loadError}</p><PrimaryButton onClick={fetchEmployees}>Retry</PrimaryButton></div> : <DataTable columns={columns} data={employees} loading={loading}
          emptyState={<EmptyState icon={UserCog} title="No employees found" description="Add employees to manage your team." action={<PrimaryButton onClick={openCreate} icon={Plus}>Add Employee</PrimaryButton>} />}
          pagination={{ page, limit: 15, total }} onPageChange={setPage} />}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Employee' : 'Add Employee'} size="lg">
        <form onSubmit={handleSave}>
          {errors.general && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#DC2626' }}>{errors.general}</p>
            </div>
          )}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <FormInput label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <FormSelect label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </FormSelect>
            <FormSelect label="Employee Type" required value={form.employee_type} error={errors.employee_type} onChange={(e) => setForm({ ...form, employee_type: e.target.value })}>
              <option value="">Select employee type</option>
              <option value="lead_generator">Lead Generator</option>
              <option value="caller">Caller</option>
            </FormSelect>
            <FormInput label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
            <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <FormInput label="Salary ($)" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            <FormInput label="Joining Date" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
            <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Active</option>
              <option>Inactive</option>
            </FormSelect>
            {!editItem && (
              <FormInput label="Password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <FormTextarea label="Performance Notes" value={form.performance_notes} onChange={(e) => setForm({ ...form, performance_notes: e.target.value })} rows={3} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editItem ? 'Update' : 'Add Employee'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Deactivate Employee" message="Deactivate this employee account? The record will remain visible as inactive." confirmLabel="Deactivate" />
    </div>
  );
}
