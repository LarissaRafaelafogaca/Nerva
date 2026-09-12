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
import { Moon, Plus, Edit2, Trash2, Sun, Star } from 'lucide-react';

const QUALITIES = ['poor', 'fair', 'good', 'excellent'];

export default function Sleep() {
  const { t } = useI18n();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], hours: '7', bedtime: '23:00', wake_time: '07:00', quality: 'good', notes: '',
  });

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

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ date: new Date().toISOString().split('T')[0], hours: '7', bedtime: '23:00', wake_time: '07:00', quality: 'good', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      date: rec.date || new Date().toISOString().split('T')[0],
      hours: String(rec.hours || '7'), bedtime: rec.bedtime || '23:00',
      wake_time: rec.wake_time || '07:00', quality: rec.quality || 'good', notes: rec.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const data = { ...form, hours: Number(form.hours) };
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

  const chartData = useMemo(() => {
    const days = getLastNDays(7);
    return days.map((date) => {
      const rec = records.find((r) => r.date === date);
      return { date: formatDate(date), hours: rec?.hours || 0, quality: rec?.quality };
    });
  }, [records]);

  const avgHours = useMemo(() => {
    const valid = records.filter((r) => r.hours > 0).slice(0, 7);
    if (!valid.length) return 0;
    return (valid.reduce((sum, r) => sum + r.hours, 0) / valid.length).toFixed(1);
  }, [records]);

  const getHoursColor = (h) => {
    if (h >= 7) return '#10b981';
    if (h >= 6) return '#f59e0b';
    if (h > 0) return '#ef4444';
    return '#e5e7eb';
  };

  const qualColor = { poor: 'text-rose-500 bg-rose-500/10', fair: 'text-amber-500 bg-amber-500/10', good: 'text-emerald-500 bg-emerald-500/10', excellent: 'text-primary bg-primary/10' };

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
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />{t('sleep.logSleep')}
        </Button>
      </div>

      {/* Sleep tip */}
      <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm mb-1">{t('sleep.tipTitle')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('sleep.tipBody')}</p>
            <p className="text-xs font-medium text-primary mt-2">{t('sleep.recommendation')}</p>
          </div>
        </div>
      </Card>

      {/* Average + Chart */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 sm:col-span-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t('sleep.avgHours')}</p>
          <p className="text-3xl font-bold">{avgHours}<span className="text-base text-muted-foreground ml-1">{t('common.hours')}</span></p>
          <p className="text-xs text-muted-foreground mt-1">{t('sleep.last7')}</p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('sleep.last7')}</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
                        <p className="font-medium">{payload[0].payload.date}</p>
                        <p className="text-muted-foreground">{payload[0].value}h</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={getHoursColor(entry.hours)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent records */}
      {records.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <Moon className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('sleep.noSleep')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('sleep.noSleepDesc')}</p>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />{t('sleep.logSleep')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <Card key={rec.id} className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{formatDate(rec.date)}</p>
                  {rec.quality && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${qualColor[rec.quality] || ''}`}>
                      {t(`sleep.qual${capFirst(rec.quality)}`)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{rec.hours}{t('common.hours')}</span>
                  {rec.bedtime && <span className="flex items-center gap-0.5"><Moon className="w-3 h-3" />{rec.bedtime}</span>}
                  {rec.wake_time && <span className="flex items-center gap-0.5"><Sun className="w-3 h-3" />{rec.wake_time}</span>}
                </div>
                {rec.notes && <p className="text-xs text-muted-foreground mt-1 italic">{rec.notes}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(rec)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => del(rec)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
            <div className="space-y-2">
              <Label htmlFor="hours">{t('sleep.sleepHours')}</Label>
              <Input id="hours" type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
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
            <Button onClick={save}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function capFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}