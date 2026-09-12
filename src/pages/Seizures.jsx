import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/doseUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Activity, Plus, Trash2, Edit2 } from 'lucide-react';

const SEIZURE_TYPES = ['focal', 'generalized', 'absence', 'tonic_clonic', 'myoclonic', 'other'];
const SEVERITIES = ['mild', 'moderate', 'severe'];
const TRIGGERS = ['triggerStress', 'triggerSleep', 'triggerMissedMed', 'triggerFatigue', 'triggerFlash', 'triggerFever', 'triggerNone'];

function toLocalDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function Seizures() {
  const { t } = useI18n();
  const [seizures, setSeizures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    date_time: toLocalDateTime(new Date().toISOString()),
    type: 'focal', duration_minutes: '', severity: 'mild', triggers: [], notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Seizure.list('-date_time', 50);
      setSeizures(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ date_time: toLocalDateTime(new Date().toISOString()), type: 'focal', duration_minutes: '', severity: 'mild', triggers: [], notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (sz) => {
    setEditing(sz);
    setForm({
      date_time: toLocalDateTime(sz.date_time),
      type: sz.type || 'focal', duration_minutes: sz.duration_minutes || '',
      severity: sz.severity || 'mild', triggers: sz.triggers || [], notes: sz.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const data = { ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null };
      if (editing) {
        await base44.entities.Seizure.update(editing.id, data);
      } else {
        await base44.entities.Seizure.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const del = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Seizure.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTrigger = (trig) => {
    setForm((f) => {
      const has = f.triggers.includes(trig);
      if (trig === 'triggerNone') return { ...f, triggers: has ? [] : ['triggerNone'] };
      const without = f.triggers.filter((t) => t !== 'triggerNone');
      return { ...f, triggers: has ? without : [...without, trig] };
    });
  };

  const sevColor = { mild: 'text-amber-500 bg-amber-500/10', moderate: 'text-orange-500 bg-orange-500/10', severe: 'text-rose-500 bg-rose-500/10' };

  const thisMonth = seizures.filter((s) => {
    const d = new Date(s.date_time);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

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
          <h1 className="text-2xl font-bold tracking-tight">{t('seizures.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('seizures.subtitle')}</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />{t('seizures.logSeizure')}
        </Button>
      </div>

      {seizures.length > 0 && (
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{thisMonth}</p>
            <p className="text-xs text-muted-foreground">{t('seizures.seizureCount')}</p>
          </div>
        </Card>
      )}

      {seizures.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Activity className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('seizures.noSeizures')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('seizures.noSeizuresDesc')}</p>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />{t('seizures.logSeizure')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {seizures.map((sz) => (
            <Card key={sz.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold capitalize">{t(`seizures.type${capFirst(sz.type)}`)}</h3>
                    {sz.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sevColor[sz.severity] || ''}`}>
                        {t(`seizures.sev${capFirst(sz.severity)}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(sz.date_time)}
                    {sz.duration_minutes ? ` · ${sz.duration_minutes} ${t('common.minutes')}` : ''}
                  </p>
                  {sz.triggers?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sz.triggers.map((trig) => (
                        <span key={trig} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {t(`seizures.${trig}`)}
                        </span>
                      ))}
                    </div>
                  )}
                  {sz.notes && <p className="text-sm text-muted-foreground mt-2 italic">{sz.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(sz)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(sz)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('seizures.editSeizure') : t('seizures.logSeizure')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dt">{t('seizures.dateTime')}</Label>
              <Input id="dt" type="datetime-local" value={form.date_time} onChange={(e) => setForm({ ...form, date_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('seizures.type')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SEIZURE_TYPES.map((typ) => (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => setForm({ ...form, type: typ })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors capitalize ${
                      form.type === typ ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {t(`seizures.type${capFirst(typ)}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dur">{t('seizures.duration')}</Label>
                <Input id="dur" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>{t('seizures.severity')}</Label>
                <div className="flex gap-1.5">
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setForm({ ...form, severity: sev })}
                      className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 capitalize transition-colors ${
                        form.severity === sev ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {t(`seizures.sev${capFirst(sev)}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('seizures.triggers')}</Label>
              <div className="flex flex-wrap gap-2">
                {TRIGGERS.map((trig) => (
                  <button
                    key={trig}
                    type="button"
                    onClick={() => toggleTrigger(trig)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.triggers.includes(trig) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {t(`seizures.${trig}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sznotes">{t('common.notes')} ({t('common.optional')})</Label>
              <Textarea id="sznotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={save}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
            <AlertDialogDescription> </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function capFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}