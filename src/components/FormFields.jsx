import React from 'react';

const inputStyle = {
  width: '100%',
  height: '44px',
  border: '1px solid #CBD5E1',
  borderRadius: '12px',
  padding: '0 14px',
  fontSize: '14px',
  color: '#0F172A',
  background: '#FFFFFF',
  outline: 'none'
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#334155',
  marginBottom: '6px'
};

export function FormInput({ label, required, error, ...props }) {
  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
      )}
      <input style={{ ...inputStyle, borderColor: error ? '#DC2626' : '#CBD5E1' }} {...props} />
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}

export function FormSelect({ label, required, error, children, ...props }) {
  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
      )}
      <select style={{ ...inputStyle, borderColor: error ? '#DC2626' : '#CBD5E1', cursor: 'pointer' }} {...props}>
        {children}
      </select>
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}

export function FormTextarea({ label, required, error, rows = 4, ...props }) {
  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        style={{
          width: '100%',
          minHeight: '120px',
          border: `1px solid ${error ? '#DC2626' : '#CBD5E1'}`,
          borderRadius: '12px',
          padding: '14px',
          fontSize: '14px',
          color: '#0F172A',
          background: '#FFFFFF',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit'
        }}
        {...props}
      />
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}

export function PrimaryButton({ children, onClick, type = 'button', loading, disabled, icon: Icon }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        height: '44px',
        padding: '0 18px',
        borderRadius: '12px',
        background: (loading || disabled) ? '#93C5FD' : '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        fontWeight: '600',
        fontSize: '14px',
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, type = 'button', icon: Icon }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        height: '44px',
        padding: '0 18px',
        borderRadius: '12px',
        background: '#F1F5F9',
        color: '#0F172A',
        border: '1px solid #E2E8F0',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function DangerButton({ children, onClick, type = 'button', icon: Icon }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        height: '44px',
        padding: '0 18px',
        borderRadius: '12px',
        background: '#DC2626',
        color: '#FFFFFF',
        border: 'none',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
