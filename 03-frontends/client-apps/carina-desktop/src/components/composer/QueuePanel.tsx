interface Props {
  queue: string[];
  onEdit: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onSendAll: () => void;
  onClear: () => void;
}

export default function QueuePanel({
  queue,
  onEdit,
  onRemove,
  onReorder,
  onSendAll,
  onClear,
}: Props) {
  if (queue.length === 0) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/80 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Queue ({queue.length})
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onSendAll}
            className="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-500"
          >
            Send All
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {queue.map((item, index) => (
          <div key={`${index}-${item.slice(0, 12)}`} className="flex items-start gap-2 rounded-lg bg-zinc-900 px-2 py-1.5">
            <span className="mt-1 text-[10px] text-zinc-600">{index + 1}</span>
            <textarea
              value={item}
              onChange={(event) => onEdit(index, event.target.value)}
              rows={2}
              className="min-h-[2.5rem] flex-1 resize-none bg-transparent text-xs text-zinc-200 outline-none"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onReorder(index, index - 1)}
                className="text-[10px] text-zinc-500 disabled:opacity-30"
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === queue.length - 1}
                onClick={() => onReorder(index, index + 1)}
                className="text-[10px] text-zinc-500 disabled:opacity-30"
              >
                Down
              </button>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-[10px] text-red-400"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
