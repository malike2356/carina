export function LauncherLoadingPlaceholder() {
  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: '#060c18', color: '#e8f0f8', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div
        className="flex items-center px-5 h-9 shrink-0 border-b"
        style={{ background: '#07101f', borderColor: '#1a2b45' }}
      >
        <span className="text-[10.5px] font-bold tracking-[0.15em] uppercase" style={{ color: '#3a5a7a' }}>
          CARINA LAUNCHER
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm" style={{ color: '#4a6a8a' }}>
          Loading workspace...
        </span>
      </div>
    </div>
  );
}
