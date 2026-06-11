import React from 'react';
import { Platform } from 'react-native';
import { TaskCountWidget } from '@/widgets/TaskCountWidget';
import { loadTasks } from './task-store';

const WIDGET_NAME = 'CarinaTasks';

export async function syncTaskWidgetFromStore(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const tasks = await loadTasks();
    const running = tasks.filter((t) => t.status === 'running').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;

    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () =>
        React.createElement(TaskCountWidget, { running, completed }),
    });
  } catch {
    // Expo Go or widget native module unavailable
  }
}
