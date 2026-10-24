import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Vibrix — Dependency management', description: 'Manage, monitor and analyze software dependencies in your DevOps workflow.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.classList.toggle('dark',localStorage.getItem('vibrix:theme')!=='light')}catch(e){}" }} /></head>
      <body>{children}</body>
    </html>
  );
}
