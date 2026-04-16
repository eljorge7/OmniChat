import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OmniChat CRM | MAJIA OS',
  description: 'Sistema unificado de WhatsApp y pipelines',
};

import { Providers } from '@/components/Providers';
import { ThemeProvider } from '@/components/ThemeProvider';
import AuthGuard from '@/components/AuthGuard';
import HelpCenterOverlay from "@/components/HelpCenterOverlay";
import WelcomeTourModal from "@/components/WelcomeTourModal";
import WhatsAppWidget from "@/components/WhatsAppWidget";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
       <body className={`${inter.className} bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300`}>
         <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
           <Providers>
             <AuthGuard>
             <div className="flex h-screen overflow-hidden w-full max-w-full">
               <Sidebar />
               <main className="flex-1 min-w-0 flex flex-col h-full relative z-0 overflow-y-auto">
                 {children}
                 <HelpCenterOverlay />
                 <WelcomeTourModal />
                 <WhatsAppWidget />
               </main>
             </div>
            </AuthGuard>
           </Providers>
         </ThemeProvider>
       </body>
    </html>
  );
}
