import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    ref.current?.querySelector('input, select, textarea')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? { width: 'min(720px, 100%)' } : undefined}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
