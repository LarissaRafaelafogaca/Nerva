import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useLock } from '@/lib/LockContext';
import { usePreferences } from '@/lib/PreferencesContext';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Lock, ScanFace, Fingerprint, LogOut } from 'lucide-react';
import NervaLogo from '@/components/NervaLogo';
import { verifyBiometric } from '@/lib/biometrics';
import { isIOS } from '@/lib/pushClient';

// Tela de bloqueio (overlay em tela cheia). Exige PIN e/ou biometria para entrar.
export default function LockScreen() {
  const { locked, unlock } = useLock();
  const { prefs } = usePreferences();
  const { logout } = useAuth();
  const { t } = useI18n();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const hasPin = !!prefs?.security?.pinLock;
  const hasBio = !!prefs?.security?.biometrics;

  const tryBiometric = useCallback(async () => {
    setError('');
    const ok = await verifyBiometric();
    if (ok) unlock();
    else setError(t('lock.bioFailed'));
  }, [unlock, t]);

  // Ao abrir a tela de bloqueio, tenta biometria automaticamente (se ativa e sem PIN,
  // ou como atalho). No iOS o Face ID só dispara após um gesto; então também há botão.
  useEffect(() => {
    if (locked) {
      setPin('');
      setError('');
    }
  }, [locked]);

  const submitPin = useCallback(async (value) => {
    setChecking(true);
    setError('');
    try {
      const ok = await base44.auth.verifyPin(value);
      if (ok) {
        unlock();
      } else {
        setError(t('lock.pinWrong'));
        setPin('');
      }
    } catch {
      setError(t('lock.pinWrong'));
      setPin('');
    } finally {
      setChecking(false);
    }
  }, [unlock, t]);

  // Autoenvia quando completa os 4 dígitos.
  useEffect(() => {
    if (hasPin && pin.length === 4 && !checking) {
      submitPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        <NervaLogo size={48} />
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold">{t('lock.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasPin
              ? t('lock.enterPin')
              : isIOS()
                ? t('lock.useFaceId')
                : t('lock.useFingerprint')}
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {hasPin && (
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={(v) => { setPin(v); setError(''); }}
            autoFocus
            disabled={checking}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
        )}

        {hasBio && (
          <Button variant="outline" className="w-full" onClick={tryBiometric}>
            {isIOS() ? <ScanFace className="w-4 h-4 mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            {isIOS() ? t('lock.unlockFaceId') : t('lock.unlockFingerprint')}
          </Button>
        )}

        <button
          onClick={() => logout(true)}
          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5 mt-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t('lock.logout')}
        </button>
      </div>
    </div>
  );
}
