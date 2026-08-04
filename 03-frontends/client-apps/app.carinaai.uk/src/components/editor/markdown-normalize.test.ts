import { describe, expect, it } from 'vitest';
import {
  htmlContainsLiteralMarkdown,
  looksLikeCollapsedDocumentWall,
  markdownToHtml,
  normalizeDocumentHtml,
  restoreResearchHeadingsFromPlain,
  unwrapNestedMarkdownLinks,
} from './markdown-normalize';

describe('markdown-normalize', () => {
  it('converts markdown headings and emphasis to HTML', () => {
    const html = markdownToHtml('# VERLOX\n\n**Company Name** VERLOX Ltd\n\n- **Carina**; OS');
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>Company Name</strong>');
    expect(html).toContain('<li>');
    expect(html).not.toContain('# VERLOX');
  });

  it('detects escaped markdown stored as HTML paragraphs', () => {
    const escaped =
      '<p># VERLOX - DBA Summary Sheet</p><p>*One-page investor summary*</p><p>---</p><p>**Company Name**VERLOX Ltd</p>';
    expect(htmlContainsLiteralMarkdown(escaped)).toBe(true);
    const html = normalizeDocumentHtml(escaped);
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>');
    expect(html).not.toContain('# VERLOX');
  });

  it('leaves real HTML alone', () => {
    const real = '<h1>VERLOX</h1><p><strong>Company Name</strong> VERLOX Ltd</p>';
    expect(htmlContainsLiteralMarkdown(real)).toBe(false);
    expect(normalizeDocumentHtml(real)).toBe(real);
  });

  it('unwraps nested research citation links', () => {
    const nested =
      'See [[(AI Agents Market..., n.d.)](https://example.com/a "AI Agents Market")](https://example.com/a "AI Agents Market").';
    const cleaned = unwrapNestedMarkdownLinks(nested);
    expect(cleaned).toContain('[(AI Agents Market..., n.d.)](https://example.com/a)');
    expect(cleaned).not.toContain('[[');
    const html = markdownToHtml(nested);
    expect(html).toContain('<a href="https://example.com/a"');
    expect(html).not.toMatch(/<a[^>]*>\s*<a/i);
  });

  it('rebuilds collapsed research walls into headed HTML', () => {
    const wall =
      '<p>How Many AI Agents Will Exit by 2035? Will All Businesses Adopt AI by Then? Executive Summary The global AI agents market is growing fast across every major forecast window through 2035 and beyond with substantial enterprise spend.</p>'
      + '<ol><li><p>Current Deployed Count and Growth Trajectory (2024-2035) Estimating the precise number of AI agents in operation today is complicated by definitional disagreement across analysts and vendors worldwide.</p></li></ol>';
    expect(looksLikeCollapsedDocumentWall(wall)).toBe(true);
    const html = normalizeDocumentHtml(wall);
    expect(html).toMatch(/<h1/i);
    expect(html).toMatch(/<h2/i);
    expect(html).toMatch(/Executive Summary/i);
  });

  it('restores markdown headings from plain research text', () => {
    const plain =
      'How Many AI Agents Will Exit by 2035? Executive Summary The market is large. 1. Current Deployed Count and Growth Trajectory (2024-2035) Estimating counts is hard.';
    const md = restoreResearchHeadingsFromPlain(plain);
    expect(md).toMatch(/^# /m);
    expect(md).toMatch(/^## Executive Summary/m);
    expect(md).toMatch(/^## 1\. Current Deployed/m);
  });
});
