import React from 'react';
import NervaLogo from './NervaLogo';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <NervaLogo size={56} withText />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-7">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}