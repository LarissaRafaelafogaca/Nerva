import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/doseUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';

const SEVERITIES = ['mild', 'moderate', 'severe'];

export default function SideEffects() {
  const { t } = useI18n();
  const [records, setRecords] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    medication_id: '',
    medication_name: '',
    description: '',
    severity: 'mild',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, medications] = await Promise.all([
        base44.entities.SideEffect.list('-date', 50),
        base44.entities.Medication.list(),
      ]);
      setRecords(list);
      setMeds(medications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      medication_id: '', medication_name: '', description: '', severity: 'mild', notes: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      date: rec.date || new Date().toISOString().split('T')[0],
      medication_id: rec.medication_id || '',
      medication_name: rec.medication_name || '',
      description: rec.description || '',
      severity: rec.severity || 'mild',
      notes: rec.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.description.trim()) return;
    try {
      const med = meds.find((m) => m.id === form.medication_id);
      const data = {
        ...form,
        medication_name: med ? med.name : form.medication_name,
      };
      if (editing) {
        await base44.entities.SideEffect.update(editing.id, data);
      } else {
        await base44.entities.SideEffect.create(data);
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
      await base44.entities.SideEffect.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const sevColor = {
    mild: 'text-amber-500 bg-amber-500/10',
    moderate: 'text-orange-500 bg-orange-500/10',
    severe: 'text-rose-500 bg-rose-500/10',
  };

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
          <h1 className="text-2xl font-bold tracking-tight">{t('sideEffects.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('sideEffects.subtitle')}</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />{t('sideEffects.logSideEffect')}
        </Button>
      </div>

      {records.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('sideEffects.noSideEffects')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('sideEffects.noSideEffectsDesc')}</p>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />{t('sideEffects.logSideEffect')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <Card key={rec.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{rec.description}</h3>
                    {rec.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sevColor[rec.severity] || ''}`}>
                        {t(`seizures.sev${capFirst(rec.severity)}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(rec.date)}
                    {rec.medication_name ? ` · ${rec.medication_name}` : ''}
                  </p>
                  {rec.notes && <p className="text-sm text-muted-foreground mt-1 italic">{rec.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(rec)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(rec)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('sideEffects.editSideEffect') : t('sideEffects.logSideEffect')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="seDate">{t('common.date')}</Label>
              <Input id="seDate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('sideEffects.medication')}</Label>
              <Select
                value={form.medication_id || 'none'}
                onValueChange={(v) => setForm({ ...form, medication_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('sideEffects.medicationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('sideEffects.noMedication')}</SelectItem>
                  {meds.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seDesc">{t('sideEffects.description')}</Label>
              <Input
                id="seDesc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('sideEffects.descPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('sideEffects.severity')}</Label>
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
            <div className="space-y-2">
              <Label htmlFor="seNotes">{t('common.notes')} ({t('common.optional')})</Label>
              <Textarea id="seNotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={save} disabled={!form.description.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
            <AlertDialogDescription>{t('sideEffects.deleteConfirm')}</AlertDialogDescription>
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