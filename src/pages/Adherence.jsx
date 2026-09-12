import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { calculateAdherence, getLastNDays, formatDate, markMissedDoses } from '@/lib/doseUtils';
import { medColorMap } from '@/lib/medColors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Check, X, Minus } from 'lucide-react';

export default function Adherence() {
  const { t } = useI18n();
  const [allDoses, setAllDoses] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await markMissedDoses();
      const days = 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const doses = await base44.entities.DoseLog.filter({
        scheduled_date: { $gte: startDate.toISOString().split('T')[0] },
      });
      setAllDoses(doses);
      const medications = await base44.entities.Medication.list();
      setMeds(medications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const periodDoses = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allDoses.filter((d) => d.scheduled_date >= cutoffStr);
  }, [allDoses, period]);

  const overall = calculateAdherence(periodDoses);

  const dailyData = useMemo(() => {
    const days = getLastNDays(period);
    return days.map((date) => {
      const dayDoses = periodDoses.filter((d) => d.scheduled_date === date);
      const taken = dayDoses.filter((d) => d.status === 'taken').length;
      const total = dayDoses.length;
      const rate = total > 0 ? Math.round((taken / total) * 100) : 0;
      return { date: formatDate(date), rate, taken, total };
    });
  }, [periodDoses, period]);

  const byMedication = useMemo(() => {
    return meds.map((med) => {
      const medDoses = periodDoses.filter((d) => d.medication_id === med.id);
      const stats = calculateAdherence(medDoses);
      return { med, ...stats };
    }).filter((m) => m.total > 0);
  }, [meds, periodDoses]);

  const getRateColor = (rate) => {
    if (rate >= 90) return '#10b981';
    if (rate >= 70) return '#f59e0b';
    if (rate >= 50) return '#f97316';
    return '#ef4444';
  };

  const rateMessage = overall.total === 0 ? t('adherence.noData') :
    overall.rate >= 95 ? t('adherence.perfect') :
    overall.rate >= 80 ? t('adherence.great') :
    overall.rate >= 60 ? t('adherence.good') :
    overall.rate >= 40 ? t('adherence.fair') : t('adherence.poor');

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
        <h1 className="text-2xl font-bold tracking-tight">{t('adherence.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('adherence.subtitle')}</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {p === 7 ? t('adherence.last7') : p === 30 ? t('adherence.last30') : t('adherence.last90')}
          </button>
        ))}
      </div>

      {/* Overall rate */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">{t('adherence.rate')}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold" style={{ color: getRateColor(overall.rate) }}>{overall.rate}</span>
              <span className="text-xl text-muted-foreground mb-1">%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{rateMessage}</p>
          </div>
          <div className="flex gap-3">
            <div className="text-center">
              <div className="flex items-center gap-1 text-primary">
                <Check className="w-4 h-4" />
                <span className="text-xl font-bold">{overall.taken}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('adherence.taken')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 text-rose-500">
                <X className="w-4 h-4" />
                <span className="text-xl font-bold">{overall.missed}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('adherence.missed')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Minus className="w-4 h-4" />
                <span className="text-xl font-bold">{overall.skipped}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('adherence.skipped')}</p>
            </div>
          </div>
        </div>

        {/* Daily chart */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">{t('adherence.dailyBreakdown')}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={period > 14 ? Math.floor(period / 7) : 0} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
                        <p className="font-medium">{d.date}</p>
                        <p className="text-muted-foreground">{d.taken}/{d.total} · {d.rate}%</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.total === 0 ? '#e5e7eb' : getRateColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* By medication */}
      {byMedication.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">{t('adherence.byMedication')}</h3>
          <div className="space-y-3">
            {byMedication.map(({ med, rate, taken, total }) => {
              const colors = medColorMap[med.color] || medColorMap.emerald;
              return (
                <div key={med.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                      <span className="text-sm font-medium">{med.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{taken}/{total} · {rate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: getRateColor(rate) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}