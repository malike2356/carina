import React from 'react';
import { Platform } from 'react-native';

/**
 * Home-screen widget registration is optional. Never block app launch if the
 * native module is missing or New Architecture codegen is incomplete.
 */
export function registerHomeWidgets(): void {
  if (Platform.OS !== 'android') return;
  void import('react-native-android-widget')
    .then(({ registerWidgetTaskHandler }) => {
      registerWidgetTaskHandler(async ({ renderWidget }) => {
        const { TaskCountWidget } = await import('./TaskCountWidget');
        const { loadTasks } = await import('@/lib/task-store');
        const tasks = await loadTasks();
        const running = tasks.filter((t) => t.status === 'running').length;
        const completed = tasks.filter((t) => t.status === 'completed').length;
        renderWidget(React.createElement(TaskCountWidget, { running, completed }));
      });
    })
    .catch(() => undefined);
}

// Side-effect import used by app/_layout.tsx; keep registration deferred.
setTimeout(() => {
  try {
    registerHomeWidgets();
  } catch {
    // ignore
  }
}, 0);
