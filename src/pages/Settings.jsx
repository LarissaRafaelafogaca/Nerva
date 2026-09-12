import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { usePreferences } from '@/lib/PreferencesContext';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/components/ui/use-toast';
import { Sun, Moon, Globe, Bell, BellOff, Volume2, Smartphone, Shield, Lock, Fingerprint, FileText, Trash2, Download, ChevronRight, Info as InfoIcon, Database, Share2, ScrollText, BookOpen } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';

export default function Settings() {
  const { t, lang, changeLanguage, languages } = useI18n();
  const { theme, setTheme } = useTheme();
  const { prefs, updateNotifications, updateSecurity, updatePrivacy } = usePreferences();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pinDialog, setPinDialog] = useState(false);
  const [pinStep, setPinStep] = useState('set'); // 'set' | 'confirm'
  const [pinValue, setPinValue] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [dataCollectionOpen, setDataCollectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePinToggle = (enabled) => {
    if (enabled) {
      setPinStep('set');
      setPinValue('');
      setFirstPin('');
      setPinError('');
      setPinDialog(true);
    } else {
      updateSecurity('pinLock', false);
      updateSecurity('pin', null);
    }
  };

  const handlePinComplete = () => {
    if (pinStep === 'set') {
      if (pinValue.length < 4) return;
      setFirstPin(pinValue);
      setPinValue('');
      setPinStep('confirm');
      setPinError('');
    } else {
      if (pinValue.length === 4 && pinValue === firstPin) {
        updateSecurity('pinLock', true);
        updateSecurity('pin', pinValue);
        setPinDialog(false);
        setFirstPin('');
        toast({ title: t('settings.pinSetSuccess') });
      } else {
        setPinError(t('settings.pinWrong'));
      }
    }
  };

  const handleBiometricsToggle = (enabled) => {
    if (enabled) {
      if (navigator.credentials?.create) {
        updateSecurity('biometrics', true);
        toast({ title: t('settings.biometricsEnabled') });
      } else {
        toast({ title: t('settings.biometricsNotAvailable'), variant: 'destructive' });
      }
    } else {
      updateSecurity('biometrics', false);
    }
  };

  const exportData = async () => {
    try {
      const [meds, doses, seizures, sleep, sideEffects] = await Promise.all([
        base44.entities.Medication.list(),
        base44.entities.DoseLog.list('-created_date', 500),
        base44.entities.Seizure.list('-date_time', 500),
        base44.entities.SleepRecord.list('-date', 500),
        base44.entities.SideEffect.list('-date', 500),
      ]);
      const data = {
        exportedAt: new Date().toISOString(),
        user: { email: user?.email, name: user?.full_name },
        medications: meds,
        doseLogs: doses,
        seizures,
        sleepRecords: sleep,
        sideEffects,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nerva-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('settings.exportSuccess') });
    } catch (err) {
      toast({ title: t('settings.exportFailed'), variant: 'destructive' });
    }
  };

  const deleteAllData = async () => {
    setDeleting(true);
    try {
      const userId = user?.id;
      if (userId) {
        await base44.entities.DoseLog.deleteMany({ created_by_id: userId });
        await base44.entities.Medication.deleteMany({ created_by_id: userId });
        await base44.entities.Seizure.deleteMany({ created_by_id: userId });
        await base44.entities.SleepRecord.deleteMany({ created_by_id: userId });
        await base44.entities.SideEffect.deleteMany({ created_by_id: userId });
      }
      setDeleteOpen(false);
      toast({ title: t('settings.deleteSuccess') });
      navigate('/dashboard');
    } catch (err) {
      toast({ title: t('settings.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const SettingRow = ({ icon: Icon, label, children, onClick, showChevron }) => (
    <div className="flex items-center gap-3 py-3" onClick={onClick}>
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-muted-foreground" style={{ width: 18, height: 18 }} />
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {children}
      {showChevron && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Appearance */}
      <Card className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('settings.appearance')}</h2>
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {theme === 'light' ? <Sun className="w-4.5 h-4.5 text-amber-500" style={{ width: 18, height: 18 }} /> : <Moon className="w-4.5 h-4.5 text-indigo-500" style={{ width: 18, height: 18 }} />}
          </div>
          <span className="flex-1 text-sm font-medium">{t('settings.theme')}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTheme('light')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {t('settings.light')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {t('settings.dark')}
            </button>
          </div>
        </div>
      </Card>

      {/* Language */}
      <Card className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('settings.language')}</h2>
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Globe className="w-4.5 h-4.5 text-muted-foreground" style={{ width: 18, height: 18 }} />
          </div>
          <span className="flex-1 text-sm font-medium">{t('settings.language')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                lang === l.code ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="truncate">{l.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('settings.notifications')}</h2>
        <SettingRow icon={prefs.notifications.enabled ? Bell : BellOff} label={t('settings.notifEnabled')}>
          <Switch checked={prefs.notifications.enabled} onCheckedChange={(v) => updateNotifications('enabled', v)} />
        </SettingRow>
        <div className="border-t border-border" />
        <SettingRow icon={Volume2} label={t('settings.notifSound')}>
          <Switch checked={prefs.notifications.sound} onCheckedChange={(v) => updateNotifications('sound', v)} disabled={!prefs.notifications.enabled} />
        </SettingRow>
        <div className="border-t border-border" />
        <SettingRow icon={Smartphone} label={t('settings.notifVibration')}>
          <Switch checked={prefs.notifications.vibration} onCheckedChange={(v) => updateNotifications('vibration', v)} disabled={!prefs.notifications.enabled} />
        </SettingRow>
      </Card>

      {/* Security */}
      <Card className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('settings.security')}</h2>
        <SettingRow icon={Lock} label={t('settings.pinLock')}>
          <Switch checked={prefs.security.pinLock} onCheckedChange={handlePinToggle} />
        </SettingRow>
        <div className="border-t border-border" />
        <SettingRow icon={Fingerprint} label={t('settings.biometrics')}>
          <Switch checked={prefs.security.biometrics} onCheckedChange={handleBiometricsToggle} />
        </SettingRow>
      </Card>

      {/* Privacy */}
      <Card className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('settings.privacy')}</h2>
        <SettingRow icon={Database} label={t('settings.dataCollection')} onClick={() => setDataCollectionOpen(true)} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={Share2} label={t('settings.dataSharing')}>
          <Switch checked={prefs.privacy.dataSharing} onCheckedChange={(v) => updatePrivacy('dataSharing', v)} />
        </SettingRow>
        <div className="border-t border-border" />
        <SettingRow icon={InfoIcon} label={t('settings.about')} onClick={() => navigate('/info')} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={ScrollText} label={t('settings.version')}>
          <span className="text-sm text-muted-foreground">1.0.0</span>
        </SettingRow>
        <div className="border-t border-border" />
        <SettingRow icon={FileText} label={t('settings.termsOfService')} onClick={() => navigate('/terms')} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={FileText} label={t('settings.privacyPolicy')} onClick={() => navigate('/privacy')} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={BookOpen} label={t('settings.openSource')} onClick={() => toast({ title: t('settings.openSource'), description: t('settings.openSourceBody') })} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={Download} label={t('settings.exportData')} onClick={exportData} showChevron />
        <div className="border-t border-border" />
        <SettingRow icon={Trash2} label={t('settings.deleteAll')} onClick={() => setDeleteOpen(true)} showChevron>
          <span className="text-destructive text-xs font-medium mr-2">{t('common.delete')}</span>
        </SettingRow>
      </Card>

      {/* About / Branding */}
      <Card className="p-5">
        <div className="flex flex-col items-center text-center">
          <NervaLogo size={40} withText />
          <p className="text-xs text-muted-foreground mt-3">{t('settings.aboutBody')}</p>
          <p className="text-xs text-muted-foreground/60 mt-2">{t('settings.copyright')}</p>
        </div>
      </Card>

      {/* PIN Dialog */}
      <Dialog open={pinDialog} onOpenChange={setPinDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{pinStep === 'set' ? t('settings.pinSet') : t('settings.pinConfirm')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {pinError && <p className="text-sm text-destructive mb-3">{pinError}</p>}
            <InputOTP maxLength={4} value={pinValue} onChange={(v) => { setPinValue(v); setPinError(''); }}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handlePinComplete} disabled={pinValue.length < 4}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Collection Modal */}
      <Dialog open={dataCollectionOpen} onOpenChange={setDataCollectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.dataCollectionTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed py-2">{t('settings.dataCollectionBody')}</p>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">{t('settings.dataCollection')}</span>
            <Switch
              checked={prefs.privacy.dataCollection}
              onCheckedChange={(v) => updatePrivacy('dataCollection', v)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setDataCollectionOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Data Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t('settings.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllData}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('common.loading') : t('settings.deleteConfirmBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}