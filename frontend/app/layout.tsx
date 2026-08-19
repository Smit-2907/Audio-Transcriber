import './globals.css';
import React from 'react';

export const metadata = {
  title: 'AI Multilingual Transcription Studio',
  description: 'Proof of Concept for high-accuracy multilingual audio transcription',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
