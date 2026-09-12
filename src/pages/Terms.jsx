import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';
import { useI18n } from '@/lib/i18n';

export default function Terms() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <NervaLogo size={32} withText />
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />{t('common.back')}
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-4">{t('settings.termsOfService')}</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground space-y-4">
          <p><strong>Last updated: January 2026</strong></p>
          <p>By using Nerva ("the App"), you agree to these Terms of Service. Nerva is a tool designed to help patients with epilepsy track their medication adherence, seizures, and sleep patterns.</p>
          <h3 className="text-foreground font-semibold">1. Acceptance of Terms</h3>
          <p>By creating an account and using the App, you accept these Terms in full. If you do not agree with any part of these Terms, you must not use the App.</p>
          <h3 className="text-foreground font-semibold">2. Medical Disclaimer</h3>
          <p>Nerva is an informational and tracking tool. It is NOT a medical device and does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider before making any changes to your medication or treatment plan. Never stop taking prescribed medication without consulting your doctor.</p>
          <h3 className="text-foreground font-semibold">3. User Responsibilities</h3>
          <p>You are responsible for the accuracy of the data you enter. You agree to use the App only for its intended purpose and not to misuse or attempt to gain unauthorized access to other users' data.</p>
          <h3 className="text-foreground font-semibold">4. Data and Privacy</h3>
          <p>Your health data is stored securely. You control your data and can export or delete it at any time. See our Privacy Policy for details on data handling.</p>
          <h3 className="text-foreground font-semibold">5. Limitation of Liability</h3>
          <p>Nerva is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use of the App, including but not limited to missed medications, health complications, or data loss.</p>
          <h3 className="text-foreground font-semibold">6. Changes to Terms</h3>
          <p>We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the updated Terms.</p>
          <p className="pt-4 text-xs">{t('settings.copyright')}</p>
        </div>
      </div>
    </div>
  );
}