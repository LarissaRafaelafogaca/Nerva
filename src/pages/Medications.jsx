import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { ensureTodayDoses, formatTime } from '@/lib/doseUtils';
import { medColorMap, medColorKeys } from '@/lib/medColors';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { calcTreatmentInfo, formatDateBR } from '@/lib/scheduleUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Check, X, Clock, Pill, Trash2, Edit2, Calendar, Zap } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const EMPTY_FORM = {
  name: '',
  dosage: '',
  startDate: new Date().toISOString().split('T')[0],
  startTime: '08:00',
  intervalHours: '8',
  durationDays: '30',
  color: 'emerald',
  notes: '',
  active: true,
  // modo avançado: horários manuais
  manualMode: false,
  times: ['08:00'],
};

export default function Medications() {
  const { t } = useI18n();
  const [meds, setMeds] = useState([]);
  const [todayDoses, setTodayDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Cálculo automático do cronograma em tempo real.
  const scheduleInfo = useMemo(() => {
    if (form.manualMode) return null;
    return calcTreatmentInfo(form.startDate, form.startTime, form.intervalHours, form.durationDays);
  }, [form.startDate, form.startTime, form.intervalHours, form.durationDays, form.manualMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const medications = await base44.entities.Medication.list('-created_date');
      const doses = await ensureTodayDoses(medications);
      setMeds(medications);
      setTodayDoses(doses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(loadData, { intervalMs: 20000, paused: dialogOpen || !!deleteTarget });

  const openAdd = () => {
    setEditingMed(null);
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().split('T')[0] });
    setDialogOpen(true);
  };

  const openEdit = (med) => {
    setEditingMed(med);
    // Detecta se o medicamento foi criado com o modo automático ou manual.
    // Se tem frequency com 'x ao dia' ou intervalHours salvo nas notes (heurística),
    // tenta reverter; caso contrário, abre no modo manual com os times existentes.
    setForm({
      ...EMPTY_FORM,
      name: med.name || '',
      dosage: med.dosage || '',
      color: med.color || 'emerald',
      notes: med.notes || '',
      active: med.active !== false,
      manualMode: true, // edição de med existente usa modo manual por segurança
      times: med.times?.length ? med.times : ['08:00'],
      startDate: new Date().toISOString().split('T')[0],
      startTime: med.times?.[0] || '08:00',
      intervalHours: '8',
      durationDays: '30',
    });
    setDialogOpen(true);
  };

  const saveMed = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // Usa os horários gerados automaticamente ou os manuais.
      const times = form.manualMode
        ? form.times.filter(Boolean)
        : (scheduleInfo?.times || ['08:00']);

      const frequencyLabel = form.manualMode
        ? (times.length === 1 ? '1x ao dia' : `${times.length}x ao dia`)
        : (scheduleInfo?.frequencyLabel || '');

      const payload = {
        name: form.name.trim(),
        dosage: form.dosage,
        frequency: frequencyLabel,
        times,
        color: form.color,
        notes: form.notes,
        active: form.active,
      };

      if (editingMed) {
        await base44.entities.Medication.update(editingMed.id, payload);
        toast({ title: t('meds.updated') || 'Medicamento atualizado' });
      } else {
        await base44.entities.Medication.create(payload);
        toast({ title: t('meds.created') || 'Medicamento cadastrado' });
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast({ title: t('common.saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMed = async () => {
    if (!deleteTarget) return;
    try {
      const doses = await base44.entities.DoseLog.filter({ medication_id: deleteTarget.id });
      if (doses.length) await base44.entities.DoseLog.deleteMany({ medication_id: deleteTarget.id });
      await base44.entities.Medication.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const markDose = async (dose, status) => {
    try {
      await base44.entities.DoseLog.update(dose.id, {
        status,
        taken_at: status === 'taken' ? new Date().toISOString() : null,
      });
      setTodayDoses((prev) => prev.map((d) => (d.id === dose.id ? { ...d, status } : d)));
    } catch (err) {
      console.error(err);
    }
  };

  const addTime = () => setForm((f) => ({ ...f, times: [...f.times, '12:00'] }));
  const removeTime = (idx) => setForm((f) => ({ ...f, times: f.times.filter((_, i) => i !== idx) }));
  const updateTime = (idx, val) => setForm((f) => ({ ...f, times: f.times.map((ti, i) => i === idx ? val : ti) }));

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
          <h1 className="text-2xl font-bold tracking-tight">{t('meds.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('meds.subtitle')}</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />{t('meds.addMed')}
        </Button>
      </div>

      {meds.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Pill className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('meds.noMeds')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('meds.noMedsDesc')}</p>
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1.5" />{t('meds.addMed')}</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {meds.map((med) => {
            const colors = medColorMap[med.color] || medColorMap.emerald;
            const medDoses = todayDoses.filter((d) => d.medication_id === med.id);
            return (
              <Card key={med.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl ${colors.soft} ${colors.text} flex items-center justify-center shrink-0`}>
                    <Pill className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{med.name}</h3>
                      {!med.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('meds.inactive')}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}
                      {med.times?.length ? ` · ${med.times.length}x/dia` : ''}
                    </p>
                    {med.notes && <p className="text-xs text-muted-foreground mt-1 italic">{med.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(med)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(med)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {medDoses.length > 0 && med.active !== false && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {medDoses.map((dose) => (
                      <div key={dose.id} className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground flex-1">{formatTime(dose.scheduled_time)}</span>
                        {dose.status === 'taken' ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary px-2 py-1 bg-primary/10 rounded-md">
                            <Check className="w-3 h-3" />{t('dashboard.taken')}
                          </span>
                        ) : dose.status === 'skipped' ? (
                          <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-md">{t('meds.skip')}</span>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => markDose(dose, 'taken')} className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => markDose(dose, 'skipped')} className="w-7 h-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMed ? t('meds.editMed') : t('meds.addMed')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Nome e dosagem */}
            <div className="space-y-2">
              <Label htmlFor="medName">{t('meds.medName')}</Label>
              <Input id="medName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('meds.medNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosage">{t('meds.dosage')}</Label>
              <Input id="dosage" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder={t('meds.dosagePlaceholder')} />
            </div>

            {/* Toggle modo automático / manual */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{t('meds.autoSchedule')}</span>
              </div>
              <Switch checked={!form.manualMode} onCheckedChange={(v) => setForm({ ...form, manualMode: !v })} />
            </div>

            {!form.manualMode ? (
              /* Modo automático: data início + intervalo + duração */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t('meds.startDate')}</Label>
                    <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">{t('meds.startTime')}</Label>
                    <Input id="startTime" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="interval">{t('meds.intervalHours')}</Label>
                    <Input id="interval" type="number" min="1" max="24" step="0.5" value={form.intervalHours} onChange={(e) => setForm({ ...form, intervalHours: e.target.value })} placeholder="8" />
                    <p className="text-xs text-muted-foreground">{t('meds.intervalHint')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">{t('meds.durationDays')}</Label>
                    <Input id="duration" type="number" min="1" max="365" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} placeholder="30" />
                    <p className="text-xs text-muted-foreground">{t('meds.durationHint')}</p>
                  </div>
                </div>

                {/* Prévia do cronograma calculado */}
                {scheduleInfo && (
                  <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t('meds.schedulePreview')}</p>
                    <div className="flex flex-wrap gap-2">
                      {scheduleInfo.times.map((time) => (
                        <span key={time} className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground font-medium">{time}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>📅 {t('meds.dosesPerDay')}: <strong className="text-foreground">{scheduleInfo.dosesPerDay}</strong></span>
                      <span>💊 {t('meds.totalDoses')}: <strong className="text-foreground">{scheduleInfo.totalDoses}</strong></span>
                      <span>🗓 {t('meds.endsOn')}: <strong className="text-foreground">{formatDateBR(scheduleInfo.endDate)}</strong></span>
                      <span>⏰ {t('meds.lastDose')}: <strong className="text-foreground">{scheduleInfo.endTime}</strong></span>
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-primary font-medium">{t('meds.viewSchedule')}</summary>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {scheduleInfo.preview.map((day) => (
                          <div key={day.date} className={`flex items-center gap-2 ${day.isLast ? 'opacity-60' : ''}`}>
                            <span className="text-muted-foreground w-28 shrink-0">{day.isLast ? '...' : ''} {formatDateBR(day.date)}</span>
                            <span>{day.times.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </>
            ) : (
              /* Modo manual: horários individualmente */
              <div className="space-y-2">
                <Label>{t('meds.times')}</Label>
                <div className="space-y-2">
                  {form.times.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input type="time" value={time} onChange={(e) => updateTime(idx, e.target.value)} className="flex-1" />
                      {form.times.length > 1 && (
                        <button type="button" onClick={() => removeTime(idx)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addTime}>
                    <Plus className="w-3.5 h-3.5 mr-1" />{t('meds.addTime')}
                  </Button>
                </div>
              </div>
            )}

            {/* Cor */}
            <div className="space-y-2">
              <Label>{t('meds.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {medColorKeys.map((key) => {
                  const c = medColorMap[key];
                  return (
                    <button key={key} type="button" onClick={() => setForm({ ...form, color: key })}
                      className={`w-8 h-8 rounded-full ${c.dot} ${form.color === key ? 'ring-2 ring-offset-2 ring-foreground' : ''}`} />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes')} ({t('common.optional')})</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">{t('meds.active')}</Label>
              <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveMed} disabled={!form.name.trim() || saving || (!form.manualMode && !scheduleInfo)}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
            <AlertDialogDescription>{t('meds.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
