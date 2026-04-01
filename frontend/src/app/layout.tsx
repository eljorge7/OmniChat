import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OmniChat CRM | RJL Multiservicios',
  description: 'Sistema unificado de WhatsApp y pipelines',
};

import { Providers } from '@/components/Providers';
import AuthGuard from '@/components/AuthGuard';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
       <body className={`${inter.className} bg-slate-50 text-slate-900 dark:text-slate-100`}>
         <Providers>
           <AuthGuard>
             <div className="flex h-screen overflow-hidden">
               <Sidebar />
               <main className="flex-1 flex flex-col h-full relative z-0 overflow-y-auto">
                 {children}
               </main>
             </div>
           </AuthGuard>
         </Providers>
       </body>
    </html>
  );
}
