import { redirect } from 'next/navigation';

export default function AivaCanvasPage() {
  redirect('/aiva/workers?view=canvas');
}
