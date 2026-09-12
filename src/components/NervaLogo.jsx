import React from 'react';

export default function NervaLogo({ size = 40, withText = false, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Nerva logo"
      >
        {/* Neural network / brain stylized icon */}
        <circle cx="24" cy="24" r="22" fill="hsl(var(--primary))" opacity="0.08" />
        {/* Central node */}
        <circle cx="24" cy="24" r="5" fill="hsl(var(--primary))" />
        {/* Outer nodes */}
        <circle cx="24" cy="8" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="24" cy="40" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="8" cy="24" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="40" cy="24" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="12" cy="12" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
        <circle cx="36" cy="12" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
        <circle cx="12" cy="36" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
        <circle cx="36" cy="36" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
        {/* Connections */}
        <line x1="24" y1="24" x2="24" y2="8" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="24" x2="24" y2="40" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="24" x2="8" y2="24" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="24" x2="40" y2="24" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="24" x2="12" y2="12" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.3" />
        <line x1="24" y1="24" x2="36" y2="12" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.3" />
        <line x1="24" y1="24" x2="12" y2="36" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.3" />
        <line x1="24" y1="24" x2="36" y2="36" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.3" />
        {/* Cross-connections */}
        <line x1="12" y1="12" x2="36" y2="12" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <line x1="12" y1="36" x2="36" y2="36" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <line x1="8" y1="24" x2="12" y2="12" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <line x1="8" y1="24" x2="12" y2="36" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <line x1="40" y1="24" x2="36" y2="12" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <line x1="40" y1="24" x2="36" y2="36" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
      </svg>
      {withText && (
        <span className="font-heading font-bold text-xl tracking-tight text-foreground">
          Nerva
        </span>
      )}
    </div>
  );
}