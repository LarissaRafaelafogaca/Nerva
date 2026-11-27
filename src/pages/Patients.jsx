import React, { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { formatDate } from '@/lib/doseUtils';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Activity, TrendingUp, Pill, ChevronRight, Mail, Calendar, Moon } from 'lucide-react';

export default function Patients() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.role === 'admin';

  // patientsData: array de { patient, adherence, seizureCount, activeMeds, sleepAvg }
  const [patientsData, setPatientsData] = useState([]);
  // epidemiology: { totalPatients, seizuresThisMonth, avgAdherence, activeMedCount }
  const [epidemiology, setEpidemiology] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null); // { patient, adherence, ... }
  const [detailData, setDetailData] = useState(null);       // dados detalhados do paciente selecionado
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Usa os endpoints admin que retornam dados de TODOS os pacientes,
      // com estatísticas já calculadas no servidor (isolamento RLS não bloqueia admins).
      const [patients, epi] = await Promise.all([
        base44.admin.getPatients(),
        base44.admin.getEpidemiology(),
      ]);
      setPatientsData(patients);
      setEpidemiology(epi);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza ao abrir a tela, ao focar o app e a cada 20s.
  useRefreshOnFocus(loadData, { intervalMs: 20000 });

  const openPatient = async (entry) => {
    setSelectedEntry(entry);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const detail = await base44.admin.getPatient(entry.patient.id);
      setDetailData(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const epi = epidemiology ?? { totalPatients: 0, seizuresThisMonth: 0, avgAdherence: 0, activeMedCount: 0 };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('patients.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('patients.subtitle')}</p>
      </div>

      {/* Epidemiology overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{t('patients.totalPatients')}</span>
            </div>
            <p className="text-3xl font-bold">{epi.totalPatients}</p>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-rose-500/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('patients.seizuresThisMonth')}</span>
            </div>
            <p className="text-3xl font-bold">{epi.seizuresThisMonth}</p>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-emerald-500/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('patients.avgAdherence')}</span>
            </div>
            <p className="text-3xl font-bold">{epi.avgAdherence}<span className="text-lg text-muted-foreground">%</span></p>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-amber-500/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Pill className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('patients.activeMedications')}</span>
            </div>
            <p className="text-3xl font-bold">{epi.activeMedCount}</p>
          </div>
        </Card>
      </div>

      {/* Patient list */}
      {patientsData.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('patients.noPatients')}</p>
          <p className="text-sm text-muted-foreground">{t('patients.noPatientsDesc')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {patientsData.map((entry) => {
            const { patient, adherence, seizureCount, activeMeds } = entry;
            return (
              <Card
                key={patient.id}
                className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => openPatient(entry)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-lg">
                    {patient.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{patient.full_name || t('patients.noData')}</h3>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" />{patient.email}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold">{adherence.total > 0 ? `${adherence.rate}%` : '—'}</p>
                      <p className="text-xs text-muted-foreground">{t('patients.adherence')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{activeMeds}</p>
                      <p className="text-xs text-muted-foreground">{t('patients.medications')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{seizureCount}</p>
                      <p className="text-xs text-muted-foreground">{t('patients.recentSeizures')}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
                {/* Mobile stats */}
                <div className="flex sm:hidden items-center gap-4 mt-3 pt-3 border-t border-border text-sm">
                  <div className="text-center flex-1">
                    <p className="font-bold">{adherence.total > 0 ? `${adherence.rate}%` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{t('patients.adherence')}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="font-bold">{activeMeds}</p>
                    <p className="text-xs text-muted-foreground">{t('patients.medications')}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="font-bold">{seizureCount}</p>
                    <p className="text-xs text-muted-foreground">{t('patients.recentSeizures')}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Patient detail dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('patients.patientDetail')}</DialogTitle>
          </DialogHeader>
          {detailLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {!detailLoading && selectedEntry && detailData && (
            <div className="space-y-4">
              {/* Patient info */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-2xl">
                  {selectedEntry.patient.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedEntry.patient.full_name || t('patients.noData')}</h3>
                  <p className="text-sm text-muted-foreground">{selectedEntry.patient.email}</p>
                  {selectedEntry.patient.created_date && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{t('patients.registeredOn')}: {formatDate(selectedEntry.patient.created_date)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">
                    {detailData.adherence.total > 0 ? `${detailData.adherence.rate}%` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('patients.adherence')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{detailData.medications.length}</p>
                  <p className="text-xs text-muted-foreground">{t('patients.medications')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{detailData.seizures.length}</p>
                  <p className="text-xs text-muted-foreground">{t('patients.recentSeizures')}</p>
                </div>
              </div>

              {/* Medications */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('patients.medications')}</h4>
                {detailData.medications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailData.medications.map((med) => (
                      <div key={med.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{med.name}</p>
                          <p className="text-xs text-muted-foreground">{med.dosage} {med.frequency ? `· ${med.frequency}` : ''}</p>
                        </div>
                        {!med.active && <span className="text-xs text-muted-foreground">{t('meds.inactive')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent seizures */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('patients.recentSeizures')}</h4>
                {detailData.seizures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailData.seizures.map((sz) => (
                      <div key={sz.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium capitalize">{t(`seizures.type${toPascal(sz.type)}`)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(sz.date_time)}</p>
                        </div>
                        {sz.severity && (
                          <span className="text-xs text-muted-foreground capitalize">{t(`seizures.sev${capFirst(sz.severity)}`)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sleep */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5" />{t('patients.sleepAvg')}
                </h4>
                {detailData.sleep.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-sm">
                      <span className="font-bold">
                        {(detailData.sleep.reduce((sum, s) => sum + (s.hours || 0), 0) / detailData.sleep.length).toFixed(1)}h
                      </span>
                      <span className="text-muted-foreground ml-2">({detailData.sleep.length} {t('common.hours')})</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function capFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascal(s) {
  if (!s) return '';
  return s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
