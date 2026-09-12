import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, ArrowRight } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

export default function Welcome() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, go to dashboard
  React.useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 px-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
        {/* Logo */}
        <div className="mb-8 animate-in fade-in zoom-in duration-700">
          <NervaLogo size={88} />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
          {t('welcome.title')}
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-base sm:text-lg mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
          {t('welcome.subtitle')}
        </p>

        {/* Tagline */}
        <p className="text-muted-foreground/80 text-sm mb-10 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
          {t('welcome.tagline')}
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Button
            size="lg"
            className="h-13 text-base font-medium flex-1"
            onClick={() => navigate('/login')}
          >
            <LogIn className="w-4 h-4 mr-2" />
            {t('welcome.login')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-13 text-base font-medium flex-1"
            onClick={() => navigate('/register')}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {t('welcome.createAccount')}
          </Button>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-xs text-muted-foreground/60">
          © 2026 Nerva — Academic Research
        </p>
      </div>
    </div>
  );
}