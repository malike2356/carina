import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export async function notify(
  title: string,
  body: string,
  _type: NotificationType = 'info',
): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}

export async function notifyTaskComplete(taskName: string): Promise<void> {
  await notify('Task complete', taskName, 'success');
}

export async function notifyApprovalNeeded(preview: string): Promise<void> {
  await notify('Carina needs approval', preview.slice(0, 100), 'warning');
}

export async function notifyError(message: string): Promise<void> {
  await notify('Carina encountered an error', message.slice(0, 160), 'error');
}

export async function notifyMention(sender: string, preview: string): Promise<void> {
  await notify(`Message from ${sender}`, preview.slice(0, 100), 'info');
}
