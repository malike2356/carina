import React from 'react';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  void import('react-native-android-widget').then(({ registerWidgetTaskHandler }) => {
    registerWidgetTaskHandler(async ({ renderWidget }) => {
      const { TaskCountWidget } = await import('./TaskCountWidget');
      const { loadTasks } = await import('@/lib/task-store');

      const tasks = await loadTasks();
      const running = tasks.filter((t) => t.status === 'running').length;
      const completed = tasks.filter((t) => t.status === 'completed').length;

      renderWidget(React.createElement(TaskCountWidget, { running, completed }));
    });
  });
}
