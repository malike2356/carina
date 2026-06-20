/**
 * Block streaming: flush on paragraph breaks and closed code fences
 * instead of every token chunk (DGR-ST03).
 */

export type BlockStreamFlushReason = 'paragraph' | 'code_fence' | 'force' | 'max_chars';

export class BlockStreamAssembler {
  private buffer = '';

  constructor(private readonly maxBlockChars = Number(process.env.CARINA_BLOCK_STREAM_MAX ?? '1800')) {}

  push(chunk: string): { blocks: string[]; reason?: BlockStreamFlushReason } {
    this.buffer += chunk;
    const blocks: string[] = [];

    while (this.buffer.length > 0) {
      const fenceClose = this.tryFlushCodeFence();
      if (fenceClose) {
        blocks.push(fenceClose);
        continue;
      }

      const paragraph = this.tryFlushParagraph();
      if (paragraph) {
        blocks.push(paragraph);
        continue;
      }

      if (this.buffer.length >= this.maxBlockChars) {
        blocks.push(this.buffer);
        this.buffer = '';
        return { blocks, reason: 'max_chars' };
      }
      break;
    }

    return { blocks, reason: blocks.length > 0 ? 'paragraph' : undefined };
  }

  flush(): string {
    const out = this.buffer;
    this.buffer = '';
    return out;
  }

  private tryFlushParagraph(): string | null {
    const idx = this.buffer.search(/\n\n+/);
    if (idx < 0) return null;
    const block = this.buffer.slice(0, idx + 1);
    this.buffer = this.buffer.slice(idx + 1).replace(/^\n+/, '');
    return block;
  }

  private tryFlushCodeFence(): string | null {
    const open = this.buffer.indexOf('```');
    if (open < 0) return null;
    const close = this.buffer.indexOf('```', open + 3);
    if (close < 0) return null;
    const end = close + 3;
    const block = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end);
    return block;
  }
}

export function assembleBlockStream(chunks: string[]): string[] {
  const assembler = new BlockStreamAssembler();
  const out: string[] = [];
  for (const chunk of chunks) {
    const { blocks } = assembler.push(chunk);
    out.push(...blocks);
  }
  const tail = assembler.flush();
  if (tail) out.push(tail);
  return out;
}
