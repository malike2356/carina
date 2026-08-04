import React from 'react';
import { render } from 'ink';
import { LauncherTUI } from './LauncherTUI.js';
import { disableMouseReporting, withSelectionFriendlyUnmount } from '../../terminal-selection.js';

export function renderLauncher(options: { version?: string; onLaunchChat: () => void }): () => void {
  disableMouseReporting();
  const { unmount } = render(
    <LauncherTUI version={options.version ?? '0.0.0'} onLaunchChat={options.onLaunchChat} />,
    { exitOnCtrlC: false },
  );
  return withSelectionFriendlyUnmount(unmount);
}
