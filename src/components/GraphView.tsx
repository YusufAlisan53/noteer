import { useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useFileStore, selectGraphData, selectActiveFileNode } from '../store/useFileStore';

export default function GraphView() {
  const graphData = useFileStore(selectGraphData);
  const activeNode = useFileStore(selectActiveFileNode);
  const toggleGraphView = useFileStore((s) => s.toggleGraphView);
  const openOrCreateFile = useFileStore((s) => s.openOrCreateFile);
  
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleGraphView(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleGraphView]);

  const handleNodeClick = (node: any) => {
    if (node && node.name) {
      openOrCreateFile(node.name);
      toggleGraphView(false);
    }
  };

  const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / Math.max(globalScale, 1);
    ctx.font = `${fontSize}px Inter, sans-serif`;
    
    const isActive = activeNode && activeNode.name.replace(/\.md$/i, '').toLowerCase() === node.id;
    
    // Draw Node Dot
    ctx.fillStyle = isActive ? '#8b5cf6' : '#4b5563';
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
    ctx.fill();

    // Draw Text Label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isActive ? '#d1d5db' : '#9ca3af'; // soft gray
    ctx.fillText(label, node.x, node.y + 6 + fontSize/2);
  };

  if (!graphData) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#121212] animate-fade-in flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 z-50 pointer-events-none drag-region">
        <span className="text-sm font-medium text-text-muted tracking-widest uppercase no-drag">Global Graph</span>
        <button 
          className="pointer-events-auto no-drag text-xs text-text-muted hover:text-text-primary px-3 py-1.5 rounded bg-overlay hover:bg-overlay/80 transition-colors"
          onClick={() => toggleGraphView(false)}
        >
          Close (Esc)
        </button>
      </div>
      
      <div className="flex-1 cursor-crosshair">
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={drawNode}
          nodeRelSize={4}
          linkColor={() => 'rgba(55, 65, 81, 0.6)'}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          backgroundColor="#121212"
          d3VelocityDecay={0.3}
        />
      </div>
    </div>
  );
}
