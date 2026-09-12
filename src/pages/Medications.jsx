import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { ensureTodayDoses, formatTime } from '@/lib/doseUtils';
import { medColorMap, medColorKeys } from '@/lib/medColors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Check, X, Clock, Pill, Trash2, Edit2 } from 'lucide-react';

export default function Medications() {
  const { t } = useI18n();
  const [meds, setMeds] = useState([]);
  const [todayDoses, setTodayDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '', times: ['08:00'], color: 'emerald', notes: '', active: true });

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

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditingMed(null);
    setForm({ name: '', dosage: '', frequency: '', times: ['08:00'], color: 'emerald', notes: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (med) => {
    setEditingMed(med);
    setForm({
      name: med.name || '', dosage: med.dosage || '', frequency: med.frequency || '',
      times: med.times?.length ? med.times : ['08:00'], color: med.color || 'emerald',
      notes: med.notes || '', active: med.active !== false,
    });
    setDialogOpen(true);
  };

  const saveMed = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingMed) {
        await base44.entities.Medication.update(editingMed.id, form);
      } else {
        await base44.entities.Medication.create(form);
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMed = async () => {
    if (!deleteTarget) return;
    try {
      // Delete associated dose logs first
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
  const updateTime = (idx, val) => setForm((f) => ({ ...f, times: f.times.map((t, i) => i === idx ? val : t) }));

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
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />{t('meds.addMed')}
          </Button>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{med.name}</h3>
                      {!med.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('meds.inactive')}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {med.dosage} {med.frequency ? `· ${med.frequency}` : ''}
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

                {/* Today's doses */}
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
            <div className="space-y-2">
              <Label htmlFor="medName">{t('meds.medName')}</Label>
              <Input id="medName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('meds.medNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dosage">{t('meds.dosage')}</Label>
                <Input id="dosage" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder={t('meds.dosagePlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freq">{t('meds.frequency')}</Label>
                <Input id="freq" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder={t('meds.frequencyPlaceholder')} />
              </div>
            </div>
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
            <div className="space-y-2">
              <Label>{t('meds.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {medColorKeys.map((key) => {
                  const c = medColorMap[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, color: key })}
                      className={`w-8 h-8 rounded-full ${c.dot} ${form.color === key ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                    />
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
            <Button onClick={saveMed} disabled={!form.name.trim()}>{t('common.save')}</Button>
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