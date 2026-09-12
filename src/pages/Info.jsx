import React from 'react';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Brain, Stethoscope, Zap, Heart, AlertTriangle, Info as InfoIcon, Shield } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';

export default function Info() {
  const { t } = useI18n();

  const sections = [
    { icon: Brain, color: 'text-primary bg-primary/10', title: t('info.whatIs'), body: t('info.whatIsBody') },
    { icon: Stethoscope, color: 'text-teal-500 bg-teal-500/10', title: t('info.treatment'), body: t('info.treatmentBody') },
    { icon: Zap, color: 'text-amber-500 bg-amber-500/10', title: t('info.triggers'), body: t('info.triggersBody') },
    { icon: Heart, color: 'text-rose-500 bg-rose-500/10', title: t('info.support'), body: t('info.supportBody') },
    { icon: AlertTriangle, color: 'text-red-500 bg-red-500/10', title: t('info.emergency'), body: t('info.emergencyBody') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('info.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('info.subtitle')}</p>
      </div>

      {/* Hero card */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/30 border-primary/20">
        <div className="flex flex-col items-center text-center">
          <NervaLogo size={56} />
          <p className="mt-3 text-sm text-muted-foreground max-w-md">{t('info.whatIsBody')}</p>
        </div>
      </Card>

      {/* Sections */}
      <div className="space-y-3">
        {sections.slice(1).map((section, idx) => (
          <Card key={idx} className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${section.color} flex items-center justify-center shrink-0`}>
                <section.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{section.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Disclaimer */}
      <Card className="p-4 bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <InfoIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{t('info.disclaimer')}</p>
        </div>
      </Card>

      {/* About Nerva */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <NervaLogo size={32} withText />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('settings.aboutBody')}</p>
        <p className="text-xs text-muted-foreground/60 mt-3">{t('settings.copyright')}</p>
      </Card>
    </div>
  );
}