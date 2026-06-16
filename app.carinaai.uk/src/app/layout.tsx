import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/shell/ThemeProvider';
import { DEFAULT_THEME, THEME_TOKEN_MAP } from '@/lib/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carina Cloud',
  description: 'Hosted Carina workspace with BYOK keys and browser chat.',
  icons: {
    icon: '/favicon.svg',
  },
};

const themeBootScript = `
(function() {
  try {
    var match = document.cookie.match(/(?:^|; )carina_theme=([^;]+)/);
    var theme = match ? decodeURIComponent(match[1]) : '${DEFAULT_THEME}';
    var themes = ${JSON.stringify(THEME_TOKEN_MAP)};
    var tokens = themes[theme] || themes['${DEFAULT_THEME}'];
    var root = document.documentElement;
    Object.entries(tokens).forEach(function(entry) {
      root.style.setProperty(entry[0], entry[1]);
    });
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', themes[theme] ? theme : '${DEFAULT_THEME}');
  } catch (error) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bg-base text-text-primary antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
