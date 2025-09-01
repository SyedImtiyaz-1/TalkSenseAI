import React from 'react';
import { Navbar } from './Navbar';

export function Layout({ children }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 container py-6 md:py-8">
        {children}
      </main>
      <footer className="border-t border-border py-6 md:py-0">
        <div className="container flex h-14 items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Built with React and FastAPI
          </p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Call Insights. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 