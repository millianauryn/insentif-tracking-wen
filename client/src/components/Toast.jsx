import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const DURASI = { error: 5000, success: 4200, info: 4200 };

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DURASI[type] || DURASI.info);
  }, []);

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-500" />,
    error: <AlertTriangle size={18} className="text-rose-500" />,
    info: <Info size={18} className="text-sky-500" />,
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-20 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-5 lg:right-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="panel flex items-start gap-3 px-4 py-3 shadow-pop animate-fadeUp"
          >
            <div className="mt-0.5">{icons[t.type] || icons.info}</div>
            <p className="flex-1 text-[13px] font-medium leading-snug text-ink-700">{t.message}</p>
            <button
              className="text-ink-400 hover:text-ink-700"
              aria-label="Tutup notifikasi"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);