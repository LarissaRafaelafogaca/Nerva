import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { calculateAdherence, formatDate } from '@/lib/doseUtils';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Activity, TrendingUp, Pill, ChevronRight, Mail, Calendar, Moon } from 'lucide-react';

export default function Patients() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.role === 'admin';

  const [patients, setPatients] = useState([]);
  const [allSeizures, setAllSeizures] = useState([]);
  const [allDoses, setAllDoses] = useState([]);
  const [allMeds, setAllMeds] = useState([]);
  const [allSleep, setAllSleep] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [users, seizures, doses, meds, sleepRecords] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Seizure.list('-date_time', 500),
        base44.entities.DoseLog.filter({ scheduled_date: { $gte: ninetyDaysAgo.toISOString().split('T')[0] } }),
        base44.entities.Medication.list(),
        base44.entities.SleepRecord.list('-date', 500),
      ]);

      const patientList = users.filter((u) => u.profile === 'patient' || (!u.profile && u.role === 'user'));
      setPatients(patientList);
      setAllSeizures(seizures);
      setAllDoses(doses);
      setAllMeds(meds);
      setAllSleep(sleepRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza ao abrir a tela, ao focar o app e a cada 20s.
  useRefreshOnFocus(loadData, { intervalMs: 20000 });

  // Per-patient stats
  const patientStats = useMemo(() => {
    return patients.map((p) => {
      const pDoses = allDoses.filter((d) => d.created_by_id === p.id);
      const pSeizures = allSeizures.filter((s) => s.created_by_id === p.id);
      const pMeds = allMeds.filter((m) => m.created_by_id === p.id);
      const pSleep = allSleep.filter((s) => s.created_by_id === p.id);
      const adherence = calculateAdherence(pDoses);
      const lastSeizure = pSeizures[0];
      const activeMeds = pMeds.filter((m) => m.active !== false).length;
      const sleepAvg = pSleep.length > 0
        ? (pSleep.slice(0, 7).reduce((sum, s) => sum + (s.hours || 0), 0) / Math.min(pSleep.length, 7)).toFixed(1)
        : null;
      return { patient: p, adherence, seizureCount: pSeizures.length, lastSeizure, activeMeds, sleepAvg, medCount: pMeds.length };
    });
  }, [patients, allDoses, allSeizures, allMeds, allSleep]);

  // Epidemiology overview
  const epi = useMemo(() => {
    const now = new Date();
    const seizuresThisMonth = allSeizures.filter((s) => {
      const d = new Date(s.date_time);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const patientsWithAdherence = patientStats.filter((p) => p.adherence.total > 0);
    const avgAdherence = patientsWithAdherence.length > 0
      ? Math.round(patientsWithAdherence.reduce((sum, p) => sum + p.adherence.rate, 0) / patientsWithAdherence.length)
      : 0;
    const activeMedCount = allMeds.filter((m) => m.active !== false).length;
    return { totalPatients: patients.length, seizuresThisMonth, avgAdherence, activeMedCount };
  }, [patientStats, allSeizures, allMeds, patients]);

  // Selected patient detail
  const selectedPatientData = useMemo(() => {
    if (!selectedPatient) return null;
    const pId = selectedPatient.id;
    const pDoses = allDoses.filter((d) => d.created_by_id === pId);
    const pSeizures = allSeizures.filter((s) => s.created_by_id === pId).slice(0, 5);
    const pMeds = allMeds.filter((m) => m.created_by_id === pId);
    const pSleep = allSleep.filter((s) => s.created_by_id === pId).slice(0, 7);
    const adherence = calculateAdherence(pDoses);
    return { meds: pMeds, seizures: pSeizures, sleep: pSleep, adherence };
  }, [selectedPatient, allDoses, allSeizures, allMeds, allSleep]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
      {patientStats.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <p className="font-medium mb-1">{t('patients.noPatients')}</p>
          <p className="text-sm text-muted-foreground">{t('patients.noPatientsDesc')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {patientStats.map(({ patient, adherence, seizureCount, lastSeizure, activeMeds, sleepAvg }) => (
            <Card
              key={patient.id}
              className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedPatient(patient)}
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
          ))}
        </div>
      )}

      {/* Patient detail dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('patients.patientDetail')}</DialogTitle>
          </DialogHeader>
          {selectedPatient && selectedPatientData && (
            <div className="space-y-4">
              {/* Patient info */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-2xl">
                  {selectedPatient.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedPatient.full_name || t('patients.noData')}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
                  {selectedPatient.created_date && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{t('patients.registeredOn')}: {formatDate(selectedPatient.created_date)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedPatientData.adherence.total > 0 ? `${selectedPatientData.adherence.rate}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground">{t('patients.adherence')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedPatientData.meds.length}</p>
                  <p className="text-xs text-muted-foreground">{t('patients.medications')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedPatientData.seizures.length}</p>
                  <p className="text-xs text-muted-foreground">{t('patients.recentSeizures')}</p>
                </div>
              </div>

              {/* Medications */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('patients.medications')}</h4>
                {selectedPatientData.meds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedPatientData.meds.map((med) => (
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
                {selectedPatientData.seizures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedPatientData.seizures.map((sz) => (
                      <div key={sz.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium capitalize">{t(`seizures.type${capFirst(sz.type)}`)}</p>
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
                {selectedPatientData.sleep.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('patients.noData')}</p>
                ) : (
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-sm">
                      <span className="font-bold">
                        {(selectedPatientData.sleep.reduce((sum, s) => sum + (s.hours || 0), 0) / selectedPatientData.sleep.length).toFixed(1)}h
                      </span>
                      <span className="text-muted-foreground ml-2">({selectedPatientData.sleep.length} {t('common.hours')})</span>
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