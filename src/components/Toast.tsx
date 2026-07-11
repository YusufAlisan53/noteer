import { useToastStore } from '../store/useToastStore';

export default function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        return (
          <div
            key={toast.id}
            className={`
              animate-fade-in
              bg-[#1e1e1e] border
              ${isError ? 'border-red-900/50 text-red-400' : 'border-gray-800 text-gray-300'}
              shadow-lg rounded px-3 py-2
              text-xs flex items-center min-w-[120px] pointer-events-auto
            `}
          >
            {isError && (
              <svg className="w-3.5 h-3.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {!isError && toast.type === 'success' && (
              <svg className="w-3 h-3 mr-2 text-green-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="flex-1 truncate">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
