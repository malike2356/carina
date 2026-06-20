'use client';

export function ThinkingIndicator() {
  return (
    <div className="flex max-w-[85%] items-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-bubble-assistant px-4 py-3.5">
        <span
          className="block h-2 w-2 rounded-full bg-text-muted"
          style={{ animation: 'carina-thinking 1.2s ease-in-out infinite', animationDelay: '0ms' }}
        />
        <span
          className="block h-2 w-2 rounded-full bg-text-muted"
          style={{ animation: 'carina-thinking 1.2s ease-in-out infinite', animationDelay: '200ms' }}
        />
        <span
          className="block h-2 w-2 rounded-full bg-text-muted"
          style={{ animation: 'carina-thinking 1.2s ease-in-out infinite', animationDelay: '400ms' }}
        />
      </div>
    </div>
  );
}
