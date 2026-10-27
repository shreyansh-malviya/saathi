import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, tone = 'info', ms = 3800) => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      info: (m) => show(m, 'info'),
      ok: (m) => show(m, 'ok'),
      error: (m) => show(m?.message || m, 'error', 5200),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.message}</span>
            <button className="btn-ghost" style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
