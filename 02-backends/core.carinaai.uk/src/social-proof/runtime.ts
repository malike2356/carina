/**
 * Carina social-proof runtime (file-backed store under data/).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TestimonialStore,
  approve,
  reject,
  tag,
  assignProduct,
  collectFromPrimaryPlatforms,
  manualEntry,
  buildProofPageModel,
  renderProofPageHtml,
  runWeeklyCollection,
  inbox,
  curateTop,
} from './index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA = path.resolve(HERE, '../../../data/social-proof/testimonials.json');
const FIXTURES = path.resolve(HERE, 'fixtures/sample-collect.json');

let store: TestimonialStore | null = null;

export function getSocialProofStore(): TestimonialStore {
  if (!store) {
    const filePath = process.env.CARINA_SOCIAL_PROOF_PATH || DEFAULT_DATA;
    store = new TestimonialStore(filePath);
  }
  return store;
}

export function resetSocialProofStoreForTests(): void {
  store = null;
}

export async function collectSocialProof(opts?: { forceFixtures?: boolean }): Promise<unknown> {
  const s = getSocialProofStore();
  return collectFromPrimaryPlatforms(s, {
    twitterUsername: process.env.CARINA_TWITTER_USERNAME || 'carinaai',
    linkedinCompany: process.env.CARINA_LINKEDIN_COMPANY || 'carina',
    githubRepo: process.env.CARINA_GITHUB_REPO || 'malike2356/carina-ai',
    product: 'carina',
    fixturesPath: opts?.forceFixtures || process.env.CARINA_SOCIAL_PROOF_USE_FIXTURES === '1' ? FIXTURES : undefined,
  });
}

export function renderCarinaProofHtml(): string {
  const s = getSocialProofStore();
  const model = buildProofPageModel(s.list({ status: 'approved' }), {
    metrics: [
      { label: 'Products in the Verlox family', value: 'Carina · Aiva · Scout' },
    ],
    logos: [],
    press: [],
    videos: [],
  });
  const navHtml = `<nav style="position:fixed;top:0;left:0;right:0;height:64px;background:rgba(9,22,30,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(26,95,122,.12);z-index:20">
  <div style="max-width:900px;margin:0 auto;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem">
    <a href="/" style="color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:1.35rem">Carina</a>
    <div style="display:flex;gap:1.2rem;align-items:center">
      <a href="/use-cases/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Use cases</a>
      <a href="/security/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Security</a>
      <a href="/pricing/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Pricing</a>
      <a href="/proof/" style="color:#f5a623;text-decoration:none;font-size:.875rem">Proof</a>
      <a href="/docs/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Docs</a>
      <a href="/book-demo/" style="background:#f5a623;color:#09161e;padding:.4rem 1rem;border-radius:6px;text-decoration:none;font-size:.875rem">Book a live demonstration</a>
    </div>
  </div>
</nav>`;
  return renderProofPageHtml(model, {
    brand: 'Carina',
    title: 'Proof; Carina AI',
    canonicalUrl: 'https://carinaai.uk/proof',
    navHtml,
  });
}

export {
  approve,
  reject,
  tag,
  assignProduct,
  manualEntry,
  inbox,
  curateTop,
  runWeeklyCollection,
  FIXTURES,
};
