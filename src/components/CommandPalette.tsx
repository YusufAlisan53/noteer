import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../store/useUIStore';
import {
  useFileStore,
  selectTree,
  selectRecentFiles,
  searchFiles,
} from '../store/useFileStore';
import type { FileNode } from '../types';

export default function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const close = useUIStore((s) => s.closeCommandPalette);

  const tree = useFileStore(selectTree);
  const recentFiles = useFileStore(selectRecentFiles);
  const openFile = useFileStore((s) => s.openFile);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Derive results
  let results: FileNode[] = [];
  if (query.trim() === '') {
    // If empty, show recent files by finding them in the tree
    // (Note: finding them repeatedly on render is okay for max 5 items)
    const recentNodes: FileNode[] = [];
    for (const p of recentFiles) {
      function findPath(nodes: FileNode[], target: string): FileNode | null {
        for (const node of nodes) {
          if (node.path === target) return node;
          if (node.children) {
            const found = findPath(node.children, target);
            if (found) return found;
          }
        }
        return null;
      }
      const node = findPath(tree, p);
      if (node) recentNodes.push(node);
    }
    results = recentNodes;
  } else {
    results = searchFiles(tree, query).slice(0, 20); // Cap at 20 results for perf
  }

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small timeout ensures the modal renders before we focus
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          openFile(selected);
          close();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, openFile, close]);

  // Adjust selectedIndex if results shrink
  useEffect(() => {
    if (selectedIndex >= results.length && results.length > 0) {
      setSelectedIndex(results.length - 1);
    }
  }, [results.length, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-lg bg-[#1e1e1e] border border-gray-800 shadow-2xl rounded-lg overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-gray-800">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 h-14 bg-transparent text-gray-200 placeholder-gray-500 outline-none border-none text-lg"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0); // reset selection on type
            }}
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-[10px] font-mono text-gray-500 bg-black/30 rounded border border-gray-800">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && query.trim() !== '' ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No notes found matching "{query}"
            </div>
          ) : results.length === 0 && query.trim() === '' ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Type to search or select a recent file.
            </div>
          ) : (
            <ul className="space-y-1">
              {results.map((node, index) => {
                const isSelected = index === selectedIndex;
                const basename = node.name.replace(/\.md$/i, '');
                return (
                  <li key={node.path}>
                    <button
                      className={`
                        w-full flex items-center px-3 py-2.5 rounded text-sm text-left
                        transition-colors duration-75
                        ${isSelected ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/50'}
                      `}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        openFile(node);
                        close();
                      }}
                    >
                      <svg className={`w-4 h-4 mr-3 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">{basename}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
