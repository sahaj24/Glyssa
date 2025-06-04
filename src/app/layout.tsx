         import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Glyssa - AI-Powered Code Analysis',
  description: 'Analyze GitHub repositories, generate interactive diagrams, and get AI-powered insights about your code',
  keywords: ['code analysis', 'github', 'repository analyzer', 'AI', 'code insights', 'interactive diagrams'],
  authors: [{ name: 'Glyssa Team' }],
  creator: 'Glyssa',
  publisher: 'Glyssa',
  applicationName: 'Glyssa',
  themeColor: '#f8fafc',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${robotoMono.variable} antialiased h-full`}
      >
        {children}
      </body>
    </html>
  );
}
