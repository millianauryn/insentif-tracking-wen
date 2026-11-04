import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setReq({
          title: opts.title || 'Konfirmasi',
          message: opts.message || '',
          confirmLabel: opts.confirmLabel || 'Ya, Lanjutkan',
          cancelLabel: opts.cancelLabel || 'Batal',
          tone: opts.tone === 'brand' ? 'brand' : 'danger',
          onResolve: resolve,
        });
      }),
    []
  );

  const answer = (val) => {
    req?.onResolve(val);
    setReq(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!req} onClose={() => answer(false)} title={req?.title} width="max-w-md">
        {req && (
          <div className="space-y-4">
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] ${
                req.tone === 'brand'
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="whitespace-pre-line leading-relaxed">{req.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button className="btn-ghost" onClick={() => answer(false)}>
                {req.cancelLabel}
              </button>
              <button className={req.tone === 'brand' ? 'btn-brand' : 'btn-danger'} onClick={() => answer(true)}>
                {req.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam <ConfirmProvider>.');
  return ctx;
}