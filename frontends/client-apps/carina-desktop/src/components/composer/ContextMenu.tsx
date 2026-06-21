interface Props {
  x: number;
  y: number;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClearDraft: () => void;
  onToggleQueue: () => void;
  onToggleVoice: () => void;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  onCut,
  onCopy,
  onPaste,
  onClearDraft,
  onToggleQueue,
  onToggleVoice,
  onClose,
}: Props) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close context menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-44 rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl"
        style={{ left: x, top: y }}
      >
        <MenuItem label="Cut" onClick={() => { onCut(); onClose(); }} />
        <MenuItem label="Copy" onClick={() => { onCopy(); onClose(); }} />
        <MenuItem label="Paste" onClick={() => { onPaste(); onClose(); }} />
        <Divider />
        <MenuItem label="Clear draft" onClick={() => { onClearDraft(); onClose(); }} />
        <Divider />
        <MenuItem label="Enable queue mode" onClick={() => { onToggleQueue(); onClose(); }} />
        <MenuItem label="Toggle voice input" onClick={() => { onToggleVoice(); onClose(); }} />
      </div>
    </>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-zinc-800" />;
}
