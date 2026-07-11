import { useFileStore, selectActiveFileContent, selectIsSaving, selectSaveError } from '../store/useFileStore';

export default function StatusBar() {
  const content = useFileStore(selectActiveFileContent);
  const isSaving = useFileStore(selectIsSaving);
  const saveError = useFileStore(selectSaveError);

  // Calculate word count
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  // Calculate character count
  const chars = content.length;

  let saveStatusText = 'All changes saved';
  if (isSaving) {
    saveStatusText = 'Saving...';
  } else if (saveError) {
    saveStatusText = 'Save failed';
  }

  return (
    <footer className="h-6 flex items-center justify-between px-4 border-t border-[#1e1e1e] bg-[#121212] z-50 flex-shrink-0 select-none">
      <div className="flex items-center gap-4 text-[10px] text-gray-600 uppercase tracking-widest">
        <span>{words} Words</span>
        <span>{chars} Chars</span>
      </div>
      
      <div className="flex items-center text-[10px] uppercase tracking-widest">
        {saveError ? (
          <span className="text-[#ff5f57]">{saveStatusText}</span>
        ) : (
          <span className="text-gray-600 opacity-70">{saveStatusText}</span>
        )}
      </div>
    </footer>
  );
}
