import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';
import { useI18n } from '@/lib/i18n';

export default function Privacy() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const goBack = () => {
    // Volta para de onde veio (ex.: Configurações). Se não houver histórico, vai ao início.
    if (window.history.length > 1) navigate(-1);
    else navigate('/settings');
  };
  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <NervaLogo size={32} withText />
          <Button variant="outline" size="default" className="h-11 px-4 shrink-0" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />{t('common.back')}
          </Button>
        </div>
        <h1 className="text-2xl font-bold mb-4">{t('settings.privacyPolicy')}</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground space-y-4">
          <p><strong>Last updated: January 2026</strong></p>
          <p>Nerva ("we", "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your health data.</p>
          <h3 className="text-foreground font-semibold">1. Data We Collect</h3>
          <p>Nerva collects the following data that you voluntarily enter: medication names and schedules, dose logs, seizure records, sleep records, and side effects. We also collect your email address and name for account management.</p>
          <h3 className="text-foreground font-semibold">2. How We Use Your Data</h3>
          <p>Your data is used to provide you with adherence tracking, charts, insights, and reminders. We do not sell your data to third parties.</p>
          <h3 className="text-foreground font-semibold">3. Data Storage and Security</h3>
          <p>Your data is stored securely with row-level security, meaning only you (and your healthcare provider if you have an admin/clinician account) can access your records. Data is encrypted in transit and at rest.</p>
          <h3 className="text-foreground font-semibold">4. Data Sharing</h3>
          <p>You can optionally enable data sharing in Settings. When enabled, aggregated and anonymized data may be used for academic research purposes. No personally identifiable information is shared without your explicit consent.</p>
          <h3 className="text-foreground font-semibold">5. Your Rights</h3>
          <p>You have the right to access, export, and delete all your data at any time through the Settings page. You can also disable data collection, though this will limit the App's tracking features.</p>
          <h3 className="text-foreground font-semibold">6. Data Retention</h3>
          <p>Your data is retained as long as your account is active. You can delete all your data at any time, or request account deletion.</p>
          <h3 className="text-foreground font-semibold">7. Contact</h3>
          <p>For privacy questions or concerns, please contact your healthcare provider or the research team.</p>
          <p className="pt-4 text-xs">{t('settings.copyright')}</p>
        </div>
      </div>
    </div>
  );
}