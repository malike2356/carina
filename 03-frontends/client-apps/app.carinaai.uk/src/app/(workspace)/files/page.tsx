import { redirect } from 'next/navigation';

/** /files redirects into Document Vault (prompt 710). */
export default function WorkspaceFilesPage() {
  redirect('/documents');
}
