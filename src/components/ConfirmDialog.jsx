import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center py-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>{message}</p>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          style={{
            flex: 1, height: '44px', borderRadius: '12px',
            background: '#F1F5F9', color: '#0F172A',
            border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          style={{
            flex: 1, height: '44px', borderRadius: '12px',
            background: danger ? '#DC2626' : '#F59E0B', color: '#FFFFFF',
            border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
