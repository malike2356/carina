interface Props {
  visible: boolean;
}

export default function DropOverlay({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="rounded-xl border-2 border-dashed border-indigo-400 bg-zinc-900/90 px-8 py-6 text-center">
        <p className="text-sm font-medium text-zinc-100">Drop to attach</p>
        <p className="mt-1 text-xs text-zinc-400">Files will be added to your message</p>
      </div>
    </div>
  );
}
