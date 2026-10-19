import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { formatDate, getLastNDays } from '@/lib/doseUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Moon, Plus, Edit2, Trash2, Sun, Target, TrendingUp } from 'lucide-react';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';

const QUALITIES = ['poor', 'fair', 'good', 'excellent'];
const GOAL_KEY = 'nerva_sleep_goal';
const DEFAULT_GOAL = 8;

// Calcula horas dormidas entre bedtime e wake_time, considerando virada de dia.
export function calcSleepHours(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let minutes = (wh * 60 + wm) - (bh * 60 + bm);
  if (minutes <= 0) minutes += 24 * 60; // virada de dia
  return Math.round((minutes / 60) * 10) / 10; // 1 casa decimal
}

function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function getSleepScore(hours, goal) {
  if (!hours || !goal) return null;
  return Math.min(100, Math.round((hours / goal) * 100));
}

function getSleepScoreColor(score) {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

function getHoursColor(h) {
  if (h >= 7) return '#10b981';
  if (h >= 6) return '#f59e0b';
  if (h > 0) return '#ef4444';
  return '#e5e7eb';
}

export default function Sleep() {
  const { t } = useI18n();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [goalDialog, setGoalDialog] = useState(false);
  const [sleepGoal, setSleepGoal] = useState(() => {
    const saved = localStorage.getItem(GOAL_KEY);
    return saved ? parseFloat(saved) : DEFAULT_GOAL;
  });
  const [goalInput, setGoalInput] = useState(String(sleepGoal));

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    bedtime: '23:00',
    wake_time: '07:00',
    quality: 'good',
    notes: '',
  });

  // Horas calculadas automaticamente enquanto preenche o formulário.
  const calculatedHours = useMemo(() => calcSleepHours(form.bedtime, form.wake_time), [form.bedtime, form.wake_time]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SleepRecord.list('-date', 30);
      setRecords(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(loadData, { intervalMs: 30000, paused: dialogOpen || goalDialog });

  const openAdd = () => {
    setEditing(null);
    setForm({ date: new Date().toISOString().split('T')[0], bedtime: '23:00', wake_time: '07:00', quality: 'good', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      date: rec.date || new Date().toISOString().split('T')[0],
      bedtime: rec.bedtime || '23:00',
      wake_time: rec.wake_time || '07:00',
      quality: rec.quality || 'good',
      notes: rec.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const hours = calculatedHours ?? 0;
    try {
      const data = { ...form, hours };
      if (editing) {
        await base44.entities.SleepRecord.update(editing.id, data);
      } else {
        await base44.entities.SleepRecord.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const del = async (rec) => {
    try {
      await base44.entities.SleepRecord.delete(rec.id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const saveGoal = () => {
    const val = parseFloat(goalInput);
    if (val > 0 && val <= 24) {
      setSleepGoal(val);
      localStorage.setItem(GOAL_KEY, String(val));
    }
    setGoalDialog(false);
  };

  const chartData = useMemo(() => {
    const days = getLastNDays(7);
    return days.map((date) => {
      const rec = records.find((r) => r.date === date);
      return { date: formatDate(date), hours: rec?.hours || 0 };
    });
  }, [records]);

  const avgHours = useMemo(() => {
    const valid = records.filter((r) => r.hours > 0).slice(0, 7);
    if (!valid.length) return 0;
    return parseFloat((valid.reduce((sum, r) => sum + r.hours, 0) / valid.length).toFixed(1));
  }, [records]);

  const avgScore = getSleepScore(avgHours, sleepGoal);
  const avgDiff = avgHours ? parseFloat((avgHours - sleepGoal).toFixed(1)) : null;

  const qualColor = {
    poor: 'text-rose-500 bg-rose-500/10',
    fair: 'text-amber-500 bg-amber-500/10',
    good: 'text-emerald-500 bg-emerald-500/10',
    excellent: 'text-primary bg-primary/10'
  };

  // Gera mensagem automática comparando com a meta.
  function getSleepMessage(hours, goal) {
    if (!hours || !goal) return null;
    const diff = parseFloat((hours - goal).toFixed(1));
    if (diff >= 0) return t('sleep.metGoal').replace('{h}', hours).replace('{goal}', goal);
    const abs = Math.abs(diff);
    return t('sleep.belowGoal').replace('{h}', hours).replace('{diff}', abs).replace('{goal}', goal);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('sleep.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('sleep.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setGoalInput(String(sleepGoal)); setGoalDialog(true); }}>
            <Target className="w-4 h-4 mr-1.5" />{t('sleep.goal')}: {sleepGoal}h
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />{t('sleep.logSleep')}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-muted-foreground">{t('sleep.avgHours')}</span>
          </div>
          <p className="text-3xl font-bold">{avgHours || '—'}<span className="text-base text-muted-foreground ml-1">{t('common.hours')}</span></p>
          {avgDiff !== null && (
            <p className={`text-xs mt-1 font-medium ${avgDiff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {avgDiff >= 0 ? `+${avgDiff}h acima da meta` : `${Math.abs(avgDiff)}h abaixo da meta`}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{t('sleep.scoreLabel')}</span>
          </div>
          {avgScore !== null ? (
            <>
              <p className="text-3xl font-bold" style={{ color: getSleepScoreColor(avgScore) }}>{avgScore}<span className="text-base ml-0.5">%</span></p>
              <p className="text-xs text-muted-foreground mt-1">{t('sleep.goalLabel').replace('{goal}', sleepGoal)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">{t('sleep.noSleep')}</p>
          )}
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t('sleep.last7')}</p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, Math.max(10, sleepGoal + 2)]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
                      <p className="font-medium">{payload[0].payload.date}</p>
                      <p className="text-muted-foreground">{payload[0].value}h {payload[0].value > 0 ? `/ meta ${sleepGoal}h` : ''}</p>
                    </div>
                  );
                }}
              />
              {/* Linha de meta */}
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.hours === 0 ? '#e5e7eb' : getHoursColor(entry.hours >= sleepGoal ? 7 : entry.hours)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">{t('sleep.metGoalLegend').replace('{goal}', sleepGoal)}</span>
        </div>
      </Card>

      {/* Records list */}
      {records.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <Moon className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('sleep.noSleep')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('sleep.noSleepDesc')}</p>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1.5" />{t('sleep.logSleep')}</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => {
            const score = getSleepScore(rec.hours, sleepGoal);
            const msg = getSleepMessage(rec.hours, sleepGoal);
            return (
              <Card key={rec.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{formatDate(rec.date)}</p>
                      {rec.quality && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${qualColor[rec.quality] || ''}`}>
                          {t(`sleep.qual${capFirst(rec.quality)}`)}
                        </span>
                      )}
                      {score !== null && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: getSleepScoreColor(score), backgroundColor: `${getSleepScoreColor(score)}15` }}>
                          {score}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground">{rec.hours}h</span>
                      {rec.bedtime && <span className="flex items-center gap-0.5"><Moon className="w-3 h-3" />{rec.bedtime}</span>}
                      {rec.wake_time && <span className="flex items-center gap-0.5"><Sun className="w-3 h-3" />{rec.wake_time}</span>}
                    </div>
                    {msg && <p className="text-xs text-muted-foreground mt-0.5 italic">{msg}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(rec)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => del(rec)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('sleep.editSleep') : t('sleep.logSleep')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sleepDate">{t('common.date')}</Label>
              <Input id="sleepDate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bedtime">{t('sleep.bedtime')}</Label>
                <Input id="bedtime" type="time" value={form.bedtime} onChange={(e) => setForm({ ...form, bedtime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wake">{t('sleep.wakeTime')}</Label>
                <Input id="wake" type="time" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} />
              </div>
            </div>

            {/* Cálculo automático em tempo real */}
            {calculatedHours !== null && (
              <div className={`p-3 rounded-xl border-2 ${calculatedHours >= sleepGoal ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('sleep.calculated')}</span>
                  <span className="text-2xl font-bold" style={{ color: calculatedHours >= sleepGoal ? '#10b981' : '#f59e0b' }}>
                    {calculatedHours}h
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {getSleepMessage(calculatedHours, sleepGoal)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('sleep.quality')}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {QUALITIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setForm({ ...form, quality: q })}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border-2 capitalize transition-colors ${
                      form.quality === q ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {t(`sleep.qual${capFirst(q)}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleepNotes">{t('common.notes')} ({t('common.optional')})</Label>
              <Textarea id="sleepNotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={save} disabled={!calculatedHours || calculatedHours <= 0}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t('sleep.setGoal')}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-muted-foreground">{t('sleep.goalHint')}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="text-center text-lg font-bold"
              />
              <span className="text-muted-foreground font-medium">h</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveGoal}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
