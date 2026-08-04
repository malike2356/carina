import { redirect } from 'next/navigation';

type Props = { params: Promise<{ rest?: string[] }> };

export default async function PropertyChannelCatchAllRedirect({ params }: Props) {
  const { rest } = await params;
  const suffix = rest?.length ? `/${rest.join('/')}` : '';
  redirect(`/aiva/outreach/channels/youtube${suffix}`);
}
