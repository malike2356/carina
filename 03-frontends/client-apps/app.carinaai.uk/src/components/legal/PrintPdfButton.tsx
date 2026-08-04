'use client';

export function PrintPdfButton() {
  return (
    <button
      type="button"
      className="text-accent hover:underline"
      onClick={() => window.print()}
    >
      Download PDF
    </button>
  );
}
