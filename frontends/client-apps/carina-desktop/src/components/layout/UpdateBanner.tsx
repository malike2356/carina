interface Props {
  version: string;
  body?: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateBanner({ version, body, onInstall, onDismiss }: Props) {
  return (
    <div className="bg-indigo-950 border-b border-indigo-800 px-4 py-2 flex items-center gap-3 text-sm">
      <p className="flex-1 text-indigo-100">
        Carina {version} is available.{body ? ` ${body}` : ''}
      </p>
      <button type="button" onClick={onInstall} className="text-xs bg-indigo-600 text-white rounded px-2 py-1">
        Update and restart
      </button>
      <button type="button" onClick={onDismiss} className="text-xs text-indigo-300">
        Later
      </button>
    </div>
  );
}
