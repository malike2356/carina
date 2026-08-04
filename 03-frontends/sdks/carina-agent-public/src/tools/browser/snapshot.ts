export interface SnapshotElement {
  ref: string;
  tag: string;
  role?: string;
  name?: string;
  value?: string;
}

export interface SnapshotResult {
  compact: string;
  full: string;
  elements: SnapshotElement[];
  refSelectors: Map<string, string>;
}

const MAX_SNAPSHOT_CHARS = 8000;

export function buildSnapshotFromTree(
  tree: Record<string, unknown> | null,
  fullText: string,
): SnapshotResult {
  const elements: SnapshotElement[] = [];
  const refSelectors = new Map<string, string>();
  let refCounter = 0;

  function walk(node: Record<string, unknown> | null, selectorPrefix: string): void {
    if (!node) return;
    const role = String(node.role ?? '');
    const name = String(node.name ?? node.value ?? '');
    const interactive = isInteractive(role, node);

    if (interactive) {
      refCounter++;
      const ref = `@e${refCounter}`;
      const selector = `${selectorPrefix}[data-carina-ref="${refCounter}"]`;
      elements.push({ ref, tag: role || 'element', role, name: name || undefined });
      refSelectors.set(ref, selector);
    }

    const children = (node.children ?? []) as Array<Record<string, unknown>>;
    children.forEach((child, i) => walk(child, `${selectorPrefix} > *:nth-child(${i + 1})`));
  }

  walk(tree, 'body');

  const compactLines = elements.map(
    (e) => `${e.ref} [${e.tag}] ${e.name ?? ''}`.trim(),
  );
  const compact = truncate(compactLines.join('\n') || '(no interactive elements)');
  const full = truncate(fullText || compact);

  return { compact, full, elements, refSelectors };
}

function isInteractive(role: string, node: Record<string, unknown>): boolean {
  const interactiveRoles = new Set([
    'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
    'listbox', 'menuitem', 'tab', 'switch', 'searchbox',
  ]);
  if (interactiveRoles.has(role.toLowerCase())) return true;
  const tag = String(node.tagName ?? node.role ?? '').toLowerCase();
  return ['a', 'button', 'input', 'select', 'textarea'].includes(tag);
}

function truncate(text: string): string {
  if (text.length <= MAX_SNAPSHOT_CHARS) return text;
  return `${text.slice(0, MAX_SNAPSHOT_CHARS)}\n[truncated]`;
}
