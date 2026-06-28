import { redirect } from 'next/navigation';

export default function SlackSettingsPage() {
  redirect('/channels/slack');
}
