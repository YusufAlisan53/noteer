import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCallback } from 'react';
import {
  useFileStore,
  selectActiveFileContent,
  selectActiveFileNode,
} from '../store/useFileStore';
import {
  preprocessWikiLinks,
  isWikiLink,
  wikiLinkTarget,
} from '../utils/wikiLinks';
import Backlinks from './Backlinks';

export default function Preview() {
  const content       = useFileStore(selectActiveFileContent);
  const activeNode    = useFileStore(selectActiveFileNode);
  const openOrCreate  = useFileStore((s) => s.openOrCreateFile);

  const handleWikiLink = useCallback(
    (target: string) => { openOrCreate(target); },
    [openOrCreate],
  );

  if (!activeNode || !content.trim()) {
    return (
      <section
        id="preview-pane"
        className="flex flex-col flex-1 min-w-0 bg-[#121212] border-l border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 h-9 border-b border-border flex-shrink-0">
          <span className="text-xs font-medium text-text-secondary">Preview</span>
          <span className="badge">LIVE</span>
        </div>
        <div className="flex-1 flex items-center justify-center opacity-20">
          <p className="text-xs text-text-muted">Nothing to preview.</p>
        </div>
      </section>
    );
  }

  // Strip YAML frontmatter
  const contentWithoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

  // Pre-process [[wiki-links]] → [label](wikilink://target) before parsing
  const processedContent = preprocessWikiLinks(contentWithoutFrontmatter);

  return (
    <section
      id="preview-pane"
      className="flex flex-col flex-1 min-w-0 bg-[#121212] border-l border-border overflow-hidden"
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-border flex-shrink-0">
        <span className="text-xs font-medium text-text-secondary truncate">
          {activeNode.name.replace(/\.md$/, '')}
        </span>
        <span className="badge">LIVE</span>
      </div>

      {/* ── Scrollable body (prose + backlinks) ──────────────────────────── */}
      <div
        id="preview-content"
        className="selectable flex-1 overflow-y-auto flex flex-col scroll-smooth text-gray-300 leading-loose"
      >
        <div className="max-w-3xl mx-auto w-full h-full p-8 box-border flex flex-col">
          {/* Rendered Markdown */}
          <div className="flex-1">
          {activeNode.tags && activeNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {activeNode.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full text-[10px]">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="prose prose-noteer">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // ── [[Wiki Links]] ──────────────────────────────────────────
                a: ({ href, children, ...props }) => {
                  if (isWikiLink(href)) {
                    const target = wikiLinkTarget(href);
                    return (
                      <span
                        role="link"
                        tabIndex={0}
                        className="
                          text-text-muted hover:text-text-primary
                          cursor-pointer transition-colors duration-150
                          underline underline-offset-2 decoration-dotted
                          decoration-text-muted hover:decoration-accent
                        "
                        title={`Open note: ${target}`}
                        onClick={() => handleWikiLink(target)}
                        onKeyDown={(e) => e.key === 'Enter' && handleWikiLink(target)}
                      >
                        {children}
                      </span>
                    );
                  }
                  // Regular link — open in OS browser
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },

                // ── Task list items ────────────────────────────────────────
                li: ({ node: _node, className, children, ...props }) => {
                  const isTask = className?.includes('task-list-item');
                  return (
                    <li
                      className={isTask ? 'list-none flex items-start gap-2' : className}
                      {...props}
                    >
                      {children}
                    </li>
                  );
                },

                // ── Checkboxes ────────────────────────────────────────────
                input: ({ type, checked, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <span
                        className={`
                          inline-flex items-center justify-center
                          w-3.5 h-3.5 rounded-sm flex-shrink-0 mt-[3px] border
                          ${checked ? 'bg-accent border-accent' : 'border-border bg-surface'}
                        `}
                        aria-checked={checked}
                        role="checkbox"
                      >
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    );
                  }
                  return <input type={type} checked={checked} {...props} />;
                },

                // ── Code blocks ───────────────────────────────────────────
                code: ({ className, children, ...props }) => {
                  if (className?.startsWith('language-')) {
                    return <code className={className} {...props}>{children}</code>;
                  }
                  return (
                    <code className="font-mono text-accent text-[0.85em]" {...props}>
                      {children}
                    </code>
                  );
                },

                // ── Table rows — zebra ────────────────────────────────────
                tr: ({ children, ...props }) => (
                  <tr className="even:bg-overlay/30" {...props}>{children}</tr>
                ),
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* ── Backlinks panel ───────────────────────────────────────────── */}
        <Backlinks />
      </div>
    </div>
  </section>
);
}
