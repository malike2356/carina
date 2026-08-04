import { redirect } from 'next/navigation';

type Props = { params: Promise<{ rest?: string[] }> };

/** Legacy YouTube Channel route; Outreach Program owns the product. */
export default async function YouTubeChannelCatchAllRedirect({ params }: Props) {
  const { rest } = await params;
  const suffix = rest?.length ? `/${rest.join('/')}` : '';
  if (!rest?.length) {
    redirect('/aiva/outreach');
  }
  redirect(`/aiva/outreach/channels/youtube${suffix}`);
}
