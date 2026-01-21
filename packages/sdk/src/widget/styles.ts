/**
 * Widget Styles
 * Inline styles to avoid CSS conflicts
 */

export const styles = {
  container: {
    position: 'fixed' as const,
    zIndex: 99999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  'position-bottom-right': {
    bottom: '20px',
    right: '20px',
  },
  'position-bottom-left': {
    bottom: '20px',
    left: '20px',
  },
  'position-top-right': {
    top: '20px',
    right: '20px',
  },
  'position-top-left': {
    top: '20px',
    left: '20px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#008182',  // BriteCo teal
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500' as const,
    boxShadow: '0 4px 12px rgba(0, 129, 130, 0.4)',  // teal shadow
    transition: 'all 0.2s ease',
  },
  buttonHover: {
    backgroundColor: '#006A6B',  // darker teal
    transform: 'scale(1.02)',
  },
  modal: {
    position: 'absolute' as const,
    bottom: '60px',
    right: '0',
    width: '360px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
  },
  'modal-left': {
    right: 'auto',
    left: '0',
  },
  header: {
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  headerTitle: {
    margin: '0',
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  headerClose: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    padding: '4px 8px',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  body: {
    padding: '20px',
  },
  categoryButtons: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  categoryButton: {
    flex: '1',
    padding: '10px 12px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500' as const,
    transition: 'all 0.15s ease',
  },
  categoryButtonActive: {
    backgroundColor: '#E1F7F6',  // light teal
    color: '#008182',  // BriteCo teal
    borderColor: '#008182',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical' as const,
    marginBottom: '12px',
    boxSizing: 'border-box' as const,
  },
  textareaFocus: {
    outline: 'none',
    borderColor: '#008182',  // BriteCo teal
    boxShadow: '0 0 0 3px rgba(0, 129, 130, 0.1)',  // teal shadow
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#64748b',
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#008182',  // BriteCo teal
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  submitButtonDisabled: {
    backgroundColor: '#cbd5e1',
    cursor: 'not-allowed',
  },
  submitButtonHover: {
    backgroundColor: '#006A6B',  // darker teal
  },
  successMessage: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#059669',
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  successText: {
    fontSize: '16px',
    fontWeight: '500' as const,
    margin: '0 0 8px 0',
  },
  successSubtext: {
    fontSize: '14px',
    color: '#64748b',
    margin: '0',
  },
  attachmentSection: {
    marginBottom: '12px',
  },
  attachmentButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s ease',
  },
  attachmentPreview: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  attachmentImage: {
    maxWidth: '100%',
    maxHeight: '80px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  attachmentRemove: {
    position: 'absolute' as const,
    top: '-6px',
    right: '-6px',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    fontSize: '14px',
    cursor: 'pointer',
    lineHeight: '1',
  },
  attachmentError: {
    margin: '6px 0 0 0',
    fontSize: '12px',
    color: '#ef4444',
  },
};
