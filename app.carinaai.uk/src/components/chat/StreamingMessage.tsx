'use client';

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="max-w-[85%] rounded-2xl bg-bubble-assistant px-4 py-3 text-sm whitespace-pre-wrap text-text-primary">
      {content}
    </div>
  );
}
