import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const features = [
  {
    title: 'Persistent memory',
    description: 'Episodic memory with pgvector. Carina recalls relevant past conversations across sessions.',
  },
  {
    title: 'Real tool execution',
    description: 'Web search, files, shell, browser, MCP, messaging, and 70+ tools. She acts, not advises.',
  },
  {
    title: 'Multi-channel',
    description: 'CLI, web, Telegram, Discord, Slack, WhatsApp, Signal, Matrix, and more from one agent.',
  },
  {
    title: 'Skill packs',
    description: 'Vertical knowledge packs such as UK property. Author your own packs and RAG corpora.',
  },
  {
    title: 'Provider choice',
    description: 'DeepSeek, Claude, GPT-4o, Groq, Gemini, and 20+ providers. Switch mid-session.',
  },
  {
    title: 'Labyrinth Scout',
    description: 'Security and trust controls for agents that need to work in real environments.',
  },
];

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  const marketingEmbed = Boolean(siteConfig.customFields?.marketingEmbed);
  const docRoot = marketingEmbed ? '' : '/docs';

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.heroTitle}>
            Carina documentation
          </Heading>
          <p className={styles.heroSubtitle}>
            Carina is the workspace. Scout is what keeps the same workflow safe enough for real work.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to={`${docRoot}/user/getting-started`}>
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to={`${docRoot}/user/carina-cloud`}>
              Carina Cloud
            </Link>
            <Link className="button button--outline button--secondary button--lg" to={`${docRoot}/developer/intro`}>
              Developer guide
            </Link>
          </div>
        </div>
      </header>
      <main className="container margin-vert--lg">
        <div className="row">
          {features.map((f) => (
            <div key={f.title} className="col col--4 margin-bottom--lg">
              <Heading as="h3">{f.title}</Heading>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
