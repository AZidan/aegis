'use client';

export function CodeViewer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="flex text-[13px] font-mono leading-[1.8]">
      <div className="flex-shrink-0 py-4 pl-4 pr-3 text-right select-none">
        {lines.map((_, i) => (
          <div key={i} className="text-indigo-700/40">
            {i + 1}
          </div>
        ))}
      </div>
      <div className="flex-1 py-4 pr-6 overflow-x-auto">
        {lines.map((line, i) => (
          <div
            key={i}
            className="px-3 -mx-3 rounded hover:bg-indigo-500/[0.08] text-neutral-300"
          >
            {line || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}
