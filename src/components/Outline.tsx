import { useMemo } from 'react';
import { useFileStore, selectActiveFileContent } from '../store/useFileStore';
import { extractHeadings } from '../utils/markdown';

export default function Outline() {
  const content = useFileStore(selectActiveFileContent);

  const headings = useMemo(() => {
    return extractHeadings(content);
  }, [content]);

  if (headings.length === 0) return null;

  return (
    <aside className="w-56 bg-[#121212] border-l border-[#1e1e1e] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="sticky top-0 bg-[#121212]/90 backdrop-blur-sm px-4 py-3 z-10">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
          Outline
        </span>
      </div>
      <nav className="p-2 space-y-0.5">
        {headings.map((heading, i) => {
          // Calculate indentation. H1 = 0, H2 = pl-3, H3 = pl-6, etc.
          const paddingLeft = Math.max(0, (heading.level - 1) * 12);
          
          return (
            <div
              key={i}
              className="flex items-center group cursor-pointer"
              style={{ paddingLeft }}
            >
              <div className="w-full truncate text-[13px] text-gray-500 hover:text-gray-200 transition-colors py-1 px-2 rounded hover:bg-[#1a1a1a]">
                {heading.text}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
