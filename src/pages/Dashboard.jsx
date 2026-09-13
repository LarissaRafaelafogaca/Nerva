import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { ensureTodayDoses, calculateAdherence, getGreeting, formatTime, formatDate } from '@/lib/doseUtils';
import { medColorMap } from '@/lib/medColors';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { toast } from '@/components/ui/use-toast';
import confetti from 'canvas-confetti';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Moon, Activity, TrendingUp, Plus, Clock, ChevronRight, Award } from 'lucide-react';

// Pequena explosão de confete para celebrar conquistas.
function celebrate() {
  try {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#0f766e', '#14b8a6', '#f59e0b'] });
  } catch {
    /* ambiente sem suporte */
  }
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meds, setMeds] = useState([]);
  const [todayDoses, setTodayDoses] = useState([]);
  const [seizures, setSeizures] = useState([]);
  const [sleep, setSleep] = useState(null);
  const [allDoses, setAllDoses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const medications = await base44.entities.Medication.list();
      const doses = await ensureTodayDoses(medications);
      setMeds(medications);
      setTodayDoses(doses);

      const seizureList = await base44.entities.Seizure.list('-date_time', 3);
      setSeizures(seizureList);

      const sleepList = await base44.entities.SleepRecord.list('-date', 1);
      setSleep(sleepList[0] || null);

      // Load last 30 days of doses for adherence streak
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const allDoseLogs = await base44.entities.DoseLog.filter({
        scheduled_date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
      });
      setAllDoses(allDoseLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega ao entrar na tela, ao focar o app e a cada 20s (atualização "ao vivo").
  useRefreshOnFocus(loadData, { intervalMs: 20000 });

  const markDose = async (dose, status) => {
    try {
      await base44.entities.DoseLog.update(dose.id, {
        status,
        taken_at: status === 'taken' ? new Date().toISOString() : null,
      });
      const nextToday = todayDoses.map((d) => (d.id === dose.id ? { ...d, status } : d));
      const nextAll = allDoses.map((d) => (d.id === dose.id ? { ...d, status } : d));
      setTodayDoses(nextToday);
      setAllDoses(nextAll);

      if (status === 'taken') {
        // Todas as doses de hoje resolvidas (tomadas ou puladas)?
        const allResolved =
          nextToday.length > 0 &&
          nextToday.every((d) => d.status === 'taken' || d.status === 'skipped');
        const anyTaken = nextToday.some((d) => d.status === 'taken');

        if (allResolved && anyTaken) {
          celebrate();
          toast({ title: t('dashboard.allDoneTitle'), description: t('dashboard.allDoneBody') });
        } else {
          toast({ title: t('dashboard.doseTakenTitle') });
        }

        // Marco de sequência (streak) — parabeniza ao cruzar 3, 7, 14, 30, ...
        const newStreak = calculateStreak(nextAll);
        celebrateStreakIfMilestone(newStreak);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const lastStreakToast = React.useRef(0);
  const celebrateStreakIfMilestone = (streakValue) => {
    const milestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
    if (streakValue > 0 && milestones.includes(streakValue) && lastStreakToast.current !== streakValue) {
      lastStreakToast.current = streakValue;
      celebrate();
      const isBig = streakValue >= 30;
      const title = (isBig ? t('dashboard.streakMilestone') : t('dashboard.streakTitle')).replace('{n}', streakValue);
      toast({ title, description: t('dashboard.streakBody') });
    }
  };

  const adherence = calculateAdherence(allDoses);
  const todayTaken = todayDoses.filter((d) => d.status === 'taken').length;
  const todayTotal = todayDoses.length;
  const greeting = getGreeting(t);
  const userName = user?.full_name?.split(' ')[0] || '';

  // Calculate streak (consecutive days with all doses taken or no doses pending at end of day)
  const streak = calculateStreak(allDoses);

  const motivationalMsg = adherence.rate >= 90 ? t('dashboard.wellDone') :
    adherence.rate >= 70 ? t('dashboard.keepGoing') : t('dashboard.needsAttention');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}{userName ? `, ${userName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('dashboard.overview')}</p>
      </div>

      {/* Adherence + Streak Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{t('dashboard.adherenceRate')}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold">{adherence.rate}</span>
              <span className="text-lg text-muted-foreground mb-0.5">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{motivationalMsg}</p>
          </div>
        </Card>

        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-amber-500/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('dashboard.streak')}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold">{streak}</span>
              <span className="text-sm text-muted-foreground mb-1 break-keep">{t('dashboard.daysAdherent')}</span>
            </div>
            {streak > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium break-keep">
                {t('dashboard.streakBody')}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Today's Medications */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t('dashboard.todayMeds')}</h2>
          <button onClick={() => navigate('/medications')} className="text-xs text-primary font-medium flex items-center hover:underline">
            {t('nav.medications')} <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
        {todayDoses.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{t('dashboard.noMedsToday')}</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/medications')}>
              <Plus className="w-4 h-4 mr-1.5" />{t('meds.addMed')}
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayDoses.map((dose) => {
              const med = meds.find((m) => m.id === dose.medication_id);
              const colorKey = med?.color || 'emerald';
              const colors = medColorMap[colorKey] || medColorMap.emerald;
              return (
                <Card key={dose.id} className="p-3.5 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${colors.soft} ${colors.text} flex items-center justify-center shrink-0`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{dose.medication_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(dose.scheduled_time)} {med?.dosage ? `· ${med.dosage}` : ''}
                    </p>
                  </div>
                  {dose.status === 'taken' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary px-2.5 py-1.5 bg-primary/10 rounded-lg">
                      <Check className="w-3.5 h-3.5" />{t('dashboard.taken')}
                    </span>
                  ) : dose.status === 'skipped' ? (
                    <span className="text-xs font-medium text-muted-foreground px-2.5 py-1.5 bg-muted rounded-lg">
                      {t('meds.skip')}
                    </span>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => markDose(dose, 'taken')}
                        className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                        title={t('dashboard.takeNow')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => markDose(dose, 'skipped')}
                        className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
                        title={t('meds.skip')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Seizures + Sleep */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('dashboard.recentSeizures')}</h2>
            <button onClick={() => navigate('/seizures')} className="text-xs text-primary font-medium flex items-center hover:underline">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {seizures.length === 0 ? (
            <Card className="p-5 text-center">
              <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('dashboard.noSeizures')}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {seizures.map((sz) => (
                <Card key={sz.id} className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{t(`seizures.type${capFirst(sz.type)}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sz.date_time)} {sz.duration_minutes ? `· ${sz.duration_minutes} ${t('common.minutes')}` : ''}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('dashboard.sleepSummary')}</h2>
            <button onClick={() => navigate('/sleep')} className="text-xs text-primary font-medium flex items-center hover:underline">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {!sleep ? (
            <Card className="p-5 text-center">
              <Moon className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('dashboard.noSleepData')}</p>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{sleep.hours}<span className="text-sm font-normal text-muted-foreground ml-1">{t('common.hours')}</span></p>
                  <p className="text-xs text-muted-foreground capitalize">{t(`sleep.qual${capFirst(sleep.quality)}`)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function capFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Conta dias consecutivos de adesão terminando em hoje.
// Um dia é "aderente" quando pelo menos uma dose foi tomada e nenhuma dose que
// já venceu ficou como perdida. Regras:
//  - HOJE conta se já houve alguma dose tomada e nenhuma "missed" (doses ainda
//    pendentes de hoje NÃO quebram, pois o dia não acabou).
//  - Dias anteriores contam se tiveram ao menos uma dose e nenhuma "missed".
//  - Dias sem nenhuma dose registrada não quebram a sequência (são ignorados).
function calculateStreak(allDoses) {
  const byDate = {};
  for (const d of allDoses) {
    if (!d.scheduled_date) continue;
    (byDate[d.scheduled_date] = byDate[d.scheduled_date] || []).push(d);
  }

  const today = new Date().toISOString().split('T')[0];

  const dayStatus = (doses, isToday) => {
    const taken = doses.filter((d) => d.status === 'taken').length;
    const missed = doses.filter((d) => d.status === 'missed').length;
    if (missed > 0) return 'broken';
    if (taken > 0) return 'adherent';
    // sem tomadas: se for hoje e ainda há pendentes, é "neutro" (não quebra);
    // em dias passados sem tomadas e sem missed, também tratamos como neutro.
    return 'neutral';
  };

  let streak = 0;
  const cursor = new Date(today + 'T00:00:00');
  for (let i = 0; i < 365; i++) {
    const dateStr = cursor.toISOString().split('T')[0];
    const doses = byDate[dateStr];
    const isToday = dateStr === today;

    if (doses && doses.length) {
      const status = dayStatus(doses, isToday);
      if (status === 'adherent') {
        streak++;
      } else if (status === 'broken') {
        break; // dose perdida quebra a sequência
      } else if (!isToday) {
        // dia passado com doses mas sem nenhuma tomada → quebra
        break;
      }
      // hoje 'neutral' (só pendentes): não soma e não quebra
    } else if (!isToday) {
      // dia passado sem nenhuma dose registrada → fim da sequência
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}