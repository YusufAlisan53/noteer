import { useEffect, useRef, useState, useId } from 'react';

// Lazily initialised Mermaid instance (avoids loading mermaid on every render).
let mermaidReady = false;

async function getMermaid() {
  const m = await import('mermaid');
  if (!mermaidReady) {
    m.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        background:       '#121212',
        primaryColor:     '#1e1e2e',
        primaryTextColor: '#cdd6f4',
        lineColor:        '#585b70',
        secondaryColor:   '#181825',
        tertiaryColor:    '#1e1e2e',
        edgeLabelBackground: '#181825',
        clusterBkg:       '#181825',
        titleColor:       '#cdd6f4',
      },
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize:   13,
    });
    mermaidReady = true;
  }
  return m.default;
}

interface MermaidDiagramProps {
  /** The raw mermaid diagram source text. */
  chart: string;
}

/**
 * Renders a Mermaid diagram synchronously-stable.
 *
 * Rendering lifecycle:
 *   1. Mount / chart change → call mermaid.render() with unique id
 *   2. On success → inject SVG via dangerouslySetInnerHTML
 *   3. On failure → show minimalist error message
 *
 * A fresh render ID is used on every chart change to prevent Mermaid's
 * internal deduplication from silently swallowing updates.
 */
export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const baseId              = useId().replace(/:/g, '');
  const containerRef        = useRef<HTMLDivElement>(null);
  const [svg, setSvg]       = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chart.trim()) return;

    let cancelled = false;
    setSvg(null);
    setError(null);
    setLoading(true);

    const renderId = `mermaid-${baseId}-${Date.now()}`;

    (async () => {
      try {
        const mermaid = await getMermaid();
        // mermaid.render returns { svg, bindFunctions }
        const { svg: rendered } = await mermaid.render(renderId, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          // Strip verbose mermaid boilerplate
          const clean = msg.split('\n')[0].replace(/^Error:\s*/i, '').trim();
          setError(clean || 'Invalid diagram syntax.');
          setSvg(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chart, baseId]);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="my-4 rounded-lg border border-[#2a2a2a] bg-[#161616] px-4 py-6 flex items-center justify-center">
        <span className="text-[11px] text-gray-500 animate-pulse">Rendering diagram…</span>
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-red-400/80 uppercase tracking-widest">Diagram Error</span>
        <code className="text-[11px] text-red-400 font-mono break-all leading-relaxed">{error}</code>
      </div>
    );
  }

  /* Rendered SVG */
  return (
    <div
      ref={containerRef}
      className="my-4 overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#161616] p-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}
