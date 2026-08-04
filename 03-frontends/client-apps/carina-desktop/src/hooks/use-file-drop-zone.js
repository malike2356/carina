import { useCallback, useEffect, useState } from 'react';
import { attachmentFromFile } from '../lib/composer-types.js';
function filesFromDataTransfer(dataTransfer) {
    if (!dataTransfer)
        return [];
    return Array.from(dataTransfer.files ?? []);
}
export function useFileDropZone(onFiles) {
    const [hovering, setHovering] = useState(false);
    const addFiles = useCallback((files) => {
        if (files.length === 0)
            return;
        onFiles(files.map((file) => attachmentFromFile(file)));
    }, [onFiles]);
    useEffect(() => {
        let unlisten;
        void (async () => {
            try {
                const { getCurrentWebview } = await import('@tauri-apps/api/webview');
                const webview = getCurrentWebview();
                unlisten = await webview.onDragDropEvent((event) => {
                    const payload = event.payload;
                    if (payload.type === 'enter') {
                        setHovering(true);
                        return;
                    }
                    if (payload.type === 'leave') {
                        setHovering(false);
                        return;
                    }
                    if (payload.type === 'drop') {
                        setHovering(false);
                        onFiles(payload.paths.map((path) => {
                            const name = path.split(/[/\\]/).pop() ?? path;
                            return attachmentFromFile(new File([], name), path);
                        }));
                    }
                });
            }
            catch {
                // Browser dev mode: HTML drag/drop only.
            }
        })();
        return () => {
            unlisten?.();
        };
    }, [onFiles]);
    useEffect(() => {
        const onDragEnter = (event) => {
            if (event.dataTransfer?.types.includes('Files')) {
                event.preventDefault();
                setHovering(true);
            }
        };
        const onDragOver = (event) => {
            if (event.dataTransfer?.types.includes('Files')) {
                event.preventDefault();
                setHovering(true);
            }
        };
        const onDragLeave = (event) => {
            if (event.relatedTarget === null)
                setHovering(false);
        };
        const onDrop = (event) => {
            event.preventDefault();
            setHovering(false);
            addFiles(filesFromDataTransfer(event.dataTransfer));
        };
        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDrop);
        return () => {
            window.removeEventListener('dragenter', onDragEnter);
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('dragleave', onDragLeave);
            window.removeEventListener('drop', onDrop);
        };
    }, [addFiles]);
    return { hovering, addFiles, setHovering };
}
