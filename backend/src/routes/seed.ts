import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '../config/database';
import { env } from '../config/env';

const router = Router();

router.post('/seed', async (req, res) => {
  const secret = req.headers['x-seed-secret'] || req.body?.secret;
  if (env.isProd && secret !== process.env.SEED_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const password = await argon2.hash('Password123');
    const adminEmail = (process.env.ADMIN_EMAILS || 'larissarafaelafogaca@gmail.com')
      .split(',')[0].trim().toLowerCase();

    // ── Admin ─────────────────────────────────────────────────────────────
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash: password, emailVerified: true, role: 'admin', profile: 'admin' },
      create: {
        email: adminEmail, passwordHash: password, fullName: 'Larissa Rafaela Fogaça',
        role: 'admin', profile: 'admin', emailVerified: true, provider: 'local',
      },
    });

    // ── Paciente demo principal ───────────────────���───────────────────────
    const demo = await prisma.user.upsert({
      where: { email: 'larissa.rafaela.aluno@unifacvest.edu.br' },
      update: { emailVerified: true, fullName: 'Ana Clara Oliveira', role: 'user', profile: 'patient', language: 'pt' },
      create: {
        email: 'larissa.rafaela.aluno@unifacvest.edu.br',
        passwordHash: password, fullName: 'Ana Clara Oliveira',
        role: 'user', profile: 'patient', emailVerified: true, provider: 'local', language: 'pt',
      },
    });

    // ── Medicamentos ──────────────────────────────────────────────────────
    // Carbamazepina — medicamento principal, desde o início
    const carba = await prisma.medication.upsert({
      where: { id: 'demo-carba' },
      update: {},
      create: {
        id: 'demo-carba', userId: demo.id,
        name: 'Carbamazepina', dosage: '400mg', frequency: '2x ao dia',
        times: ['07:00', '19:00'], color: 'emerald',
        notes: 'tomar com comida pra não dar enjoo',
        active: true,
      },
    });

    // Ácido Valpróico — adicionado no 2º mês pelo médico
    const valpro = await prisma.medication.upsert({
      where: { id: 'demo-valpro' },
      update: {},
      create: {
        id: 'demo-valpro', userId: demo.id,
        name: 'Ácido Valpróico', dosage: '500mg', frequency: '1x ao dia',
        times: ['20:00'], color: 'violet',
        notes: 'adicionado em outubro pela Dra. Fernanda, retorno em janeiro',
        active: true,
      },
    });

    // Clonazepam — usado por 2 meses, depois descontinuado
    const clona = await prisma.medication.upsert({
      where: { id: 'demo-clona' },
      update: {},
      create: {
        id: 'demo-clona', userId: demo.id,
        name: 'Clonazepam', dosage: '0,5mg', frequency: '1x ao dia (noite)',
        times: ['22:00'], color: 'teal',
        notes: 'desmamando desde novembro conforme orientação médica',
        active: false,
      },
    });

    // ── Helpers ───────────────────────────────────────────────────────────
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);

    function ds(daysBack: number): string {
      const d = new Date(todayD);
      d.setDate(d.getDate() - daysBack);
      return d.toISOString().split('T')[0];
    }

    function dt(daysBack: number, hour: number, min = 0): Date {
      const d = new Date(todayD);
      d.setDate(d.getDate() - daysBack);
      d.setHours(hour, min, 0, 0);
      return d;
    }

    // ── DOSES ─────────────────────────────────────────────────────────────
    // Carbamazepina: 180 dias. Começa esquecendo mais, vai melhorando.
    // Padrão humano: esquece mais nas 2as, quando tem prova, quando viaja.
    const carbaDoses: Array<[number, string, 'taken'|'missed'|'skipped']> = [];
    const valproDoses: Array<[number, string, 'taken'|'missed'|'skipped']> = [];
    const clonaDoses: Array<[number, string, 'taken'|'missed'|'skipped']> = [];

    // Semanas ruins (simula períodos de estresse/viagem/esquecimento)
    const badWeeks = new Set([165, 164, 163, 148, 147, 120, 119, 118, 89, 88, 52, 51, 25]);

    for (let i = 180; i >= 1; i--) {
      const isBadDay = badWeeks.has(i);
      const isWeekend = [0, 6].includes(new Date(ds(i)).getDay());

      // Carbamazepina - manhã 07:00
      let st: 'taken'|'missed'|'skipped';
      if (i > 150) {
        st = isBadDay ? 'missed' : Math.random() < 0.78 ? 'taken' : (Math.random() < 0.5 ? 'missed' : 'skipped');
      } else if (i > 90) {
        st = isBadDay ? (Math.random() < 0.6 ? 'missed' : 'skipped') : Math.random() < 0.87 ? 'taken' : 'missed';
      } else {
        st = isBadDay ? 'skipped' : Math.random() < 0.94 ? 'taken' : (Math.random() < 0.5 ? 'missed' : 'skipped');
      }
      carbaDoses.push([i, '07:00', st]);

      // Carbamazepina - noite 19:00 (esquece menos a noite)
      let stn: 'taken'|'missed'|'skipped';
      if (i > 150) {
        stn = isBadDay ? 'missed' : Math.random() < 0.84 ? 'taken' : (Math.random() < 0.4 ? 'missed' : 'skipped');
      } else if (i > 90) {
        stn = isBadDay ? 'missed' : Math.random() < 0.91 ? 'taken' : 'missed';
      } else {
        stn = isWeekend && Math.random() < 0.08 ? 'skipped' : Math.random() < 0.96 ? 'taken' : 'missed';
      }
      carbaDoses.push([i, '19:00', stn]);

      // Ácido Valpróico — começa no dia 150
      if (i <= 150) {
        const sv: 'taken'|'missed'|'skipped' = isBadDay ? (Math.random() < 0.5 ? 'missed' : 'skipped') :
          i > 90 ? (Math.random() < 0.89 ? 'taken' : 'missed') :
          (Math.random() < 0.95 ? 'taken' : (Math.random() < 0.6 ? 'missed' : 'skipped'));
        valproDoses.push([i, '20:00', sv]);
      }

      // Clonazepam — apenas dias 180 a 90 (descontinuado)
      if (i > 90) {
        const sc: 'taken'|'missed'|'skipped' = isBadDay ? 'skipped' : Math.random() < 0.88 ? 'taken' : 'missed';
        clonaDoses.push([i, '22:00', sc]);
      }
    }

    for (const [daysBack, time, status] of carbaDoses) {
      const date = ds(daysBack);
      await prisma.doseLog.upsert({
        where: { uniq_scheduled_dose: { userId: demo.id, medicationId: carba.id, scheduledDate: date, scheduledTime: time } },
        update: {},
        create: {
          userId: demo.id, medicationId: carba.id, medicationName: 'Carbamazepina',
          scheduledDate: date, scheduledTime: time, status,
          takenAt: status === 'taken' ? new Date(`${date}T${time}:00`) : null,
        },
      });
    }
    for (const [daysBack, time, status] of valproDoses) {
      const date = ds(daysBack);
      await prisma.doseLog.upsert({
        where: { uniq_scheduled_dose: { userId: demo.id, medicationId: valpro.id, scheduledDate: date, scheduledTime: time } },
        update: {},
        create: {
          userId: demo.id, medicationId: valpro.id, medicationName: 'Ácido Valpróico',
          scheduledDate: date, scheduledTime: time, status,
          takenAt: status === 'taken' ? new Date(`${date}T${time}:00`) : null,
        },
      });
    }
    for (const [daysBack, time, status] of clonaDoses) {
      const date = ds(daysBack);
      await prisma.doseLog.upsert({
        where: { uniq_scheduled_dose: { userId: demo.id, medicationId: clona.id, scheduledDate: date, scheduledTime: time } },
        update: {},
        create: {
          userId: demo.id, medicationId: clona.id, medicationName: 'Clonazepam',
          scheduledDate: date, scheduledTime: time, status,
          takenAt: status === 'taken' ? new Date(`${date}T${time}:00`) : null,
        },
      });
    }

    // ── CRISES ─────────────────────────────────────────────────────────────
    // Notas com linguagem natural, como a própria paciente escreveria
    const seizures = [
      { db: 178, h: 14, m: 30, type: 'tonic_clonic', dur: 4,   sev: 'severe',   tri: ['muito estresse', 'não dormi bem'],          note: 'fui ao pronto socorro, levei 3 dias pra me recuperar. muito ruim.' },
      { db: 171, h: 8,  m: 15, type: 'focal',        dur: 1.5, sev: 'moderate', tri: ['acordei muito cedo'],                        note: 'formigamento no braço direito antes de começar' },
      { db: 163, h: 16, m: 0,  type: 'absence',      dur: 0.5, sev: 'mild',     tri: ['luz do sol no rosto'],                       note: 'foi rápido, mal percebi mas minha colega notou' },
      { db: 155, h: 22, m: 45, type: 'tonic_clonic', dur: 2.5, sev: 'severe',   tri: ['esqueci o remédio da manhã', 'estresse'],    note: 'esqueci a carbamazepina de manhã. nunca mais esqueço.' },
      { db: 142, h: 7,  m: 10, type: 'myoclonic',    dur: 0.3, sev: 'mild',     tri: ['logo depois de acordar'],                    note: 'solavancos nos braços ao acordar, passou rápido' },
      { db: 128, h: 11, m: 20, type: 'focal',        dur: 1,   sev: 'moderate', tri: ['semana de provas', 'dormi mal'],              note: 'tava na biblioteca quando aconteceu. vergonha mas tudo bem.' },
      { db: 109, h: 19, m: 0,  type: 'absence',      dur: 0.5, sev: 'mild',     tri: ['cansaço'],                                   note: '' },
      { db: 91,  h: 23, m: 30, type: 'tonic_clonic', dur: 2,   sev: 'moderate', tri: ['dormi só 4h', 'festa'],                      note: 'foi numa sexta à noite, não dormi bem. preciso tomar mais cuidado.' },
      { db: 68,  h: 9,  m: 45, type: 'focal',        dur: 0.8, sev: 'mild',     tri: ['estresse com trabalho'],                     note: 'sensação de déjà vu antes. durou pouco.' },
      { db: 44,  h: 15, m: 0,  type: 'absence',      dur: 0.3, sev: 'mild',     tri: [],                                            note: 'minha mãe percebeu, eu não senti nada' },
      { db: 27,  h: 7,  m: 30, type: 'myoclonic',    dur: 0.2, sev: 'mild',     tri: ['ao acordar'],                                note: 'bem leve, só os braços. tomei o remédio logo depois.' },
      { db: 9,   h: 17, m: 15, type: 'focal',        dur: 0.5, sev: 'mild',     tri: ['cansaço acumulado'],                         note: 'rápida, me recuperei em 20min. acho que melhorei muito.' },
    ];

    for (const s of seizures) {
      await prisma.seizure.create({
        data: {
          userId: demo.id,
          dateTime: dt(s.db, s.h, s.m),
          type: s.type as any,
          durationMinutes: s.dur,
          severity: s.sev as any,
          triggers: s.tri,
          notes: s.note,
        },
      }).catch(() => {});
    }

    // ── SONO ──────────────────────────────────────────────────────────────
    // Nem todo dia registra (esquece fins de semana, viagens, dias ruins)
    // Notas esporádicas e informais
    const sleepNotes: Record<number, string> = {
      178: 'dia depois da crise, fiquei a tarde toda dormindo',
      155: 'péssima noite antes da crise',
      128: 'semana de provas, dormindo pouco',
      91: 'festa ontem, dormi tarde',
      30: 'tô dormindo muito melhor ultimamente',
      7: 'sono bom, acho que os remédios estão ajudando',
    };

    for (let i = 180; i >= 1; i--) {
      // Pula ~18% dos dias (esqueceu de registrar)
      if (Math.random() < 0.18) continue;
      // Nos fins de semana pula mais vezes
      if ([0, 6].includes(new Date(ds(i)).getDay()) && Math.random() < 0.12) continue;

      let hours: number;
      let quality: 'poor' | 'fair' | 'good' | 'excellent';
      let bedtime: string;
      let wakeTime: string;

      if (i > 140) {
        // começo: dormia mal (preocupação, adaptação aos remédios)
        hours = 4 + Math.round(Math.random() * 25) / 10;
        quality = Math.random() < 0.55 ? 'poor' : 'fair';
        bedtime = Math.random() < 0.5 ? '00:00' : '01:00';
        wakeTime = '07:00';
      } else if (i > 70) {
        // meio: melhorando
        hours = 5.5 + Math.round(Math.random() * 25) / 10;
        quality = Math.random() < 0.3 ? 'poor' : Math.random() < 0.6 ? 'fair' : 'good';
        bedtime = Math.random() < 0.5 ? '23:00' : '00:00';
        wakeTime = '07:00';
      } else {
        // fim: dormindo bem
        hours = 6.5 + Math.round(Math.random() * 20) / 10;
        quality = Math.random() < 0.15 ? 'fair' : Math.random() < 0.6 ? 'good' : 'excellent';
        bedtime = '22:30';
        wakeTime = Math.random() < 0.5 ? '06:30' : '07:00';
      }

      // Dias de crise: dormia muito pouco antes
      if ([178, 155, 91].includes(i)) { hours = 3.5; quality = 'poor'; }
      // Dia depois de crise: dormia muito
      if ([177, 154, 90].includes(i)) { hours = 10; quality = 'fair'; }

      const note = sleepNotes[i] ?? '';

      await prisma.sleepRecord.upsert({
        where: { uniq_sleep_per_day: { userId: demo.id, date: ds(i) } },
        update: {},
        create: {
          userId: demo.id,
          date: ds(i),
          hours: Math.min(12, Math.max(2, Math.round(hours * 10) / 10)),
          quality,
          bedtime,
          wakeTime,
          notes: note,
        },
      });
    }

    // ── EFEITOS COLATERAIS ────────────────────────────────────────────────
    // Escrita como a paciente escreveria: informal, com contexto pessoal
    const sideEffects = [
      { db: 176, mid: carba.id, mn: 'Carbamazepina', desc: 'tontura e visão borrada', sev: 'moderate', note: 'primeiros dias tomando, muito ruim. quase parei o remédio' },
      { db: 169, mid: carba.id, mn: 'Carbamazepina', desc: 'enjoo de manhã cedo', sev: 'mild', note: 'tomei sem comer e fiquei mal. aprendi a tomar com bolacha' },
      { db: 162, mid: carba.id, mn: 'Carbamazepina', desc: 'cansaço o dia todo', sev: 'mild', note: 'dormia 8h e acordava com sono. foi passando depois de umas 3 semanas' },
      { db: 155, mid: valpro.id, mn: 'Ácido Valpróico', desc: 'queda de cabelo', sev: 'mild', note: 'começou umas 2 semanas depois de iniciar o valpróico. falei com a médica' },
      { db: 148, mid: clona.id, mn: 'Clonazepam', desc: 'muita sonolência à noite', sev: 'moderate', note: 'dormia na hora de tomar mas acordava no meio da noite' },
      { db: 135, mid: valpro.id, mn: 'Ácido Valpróico', desc: 'engordei 2kg sem mudar alimentação', sev: 'mild', note: 'pesando toda semana, parece que continua subindo' },
      { db: 118, mid: carba.id, mn: 'Carbamazepina', desc: 'manchinha vermelha no braço', sev: 'mild', note: 'apareceu do nada, mostrei pra médica. ela disse pra observar, sumiu em 1 semana' },
      { db: 95,  mid: clona.id, mn: 'Clonazepam', desc: 'ansiedade quando tento parar', sev: 'moderate', note: 'cada vez que reduzo a dose fico muito ansiosa. desmame muito difícil' },
      { db: 72,  mid: valpro.id, mn: 'Ácido Valpróico', desc: 'tremor leve nas mãos', sev: 'mild', note: 'fica pior quando estou nervosa. difícil de escrever às vezes' },
      { db: 45,  mid: carba.id, mn: 'Carbamazepina', desc: 'enjoo voltou de leve', sev: 'mild', note: 'menos que no começo. acho que é quando não tomo com comida suficiente' },
      { db: 18,  mid: valpro.id, mn: 'Ácido Valpróico', desc: 'dorzinha de barriga à noite', sev: 'mild', note: 'passei a tomar com iogurte antes de dormir, ajudou bastante' },
    ];

    for (const se of sideEffects) {
      await prisma.sideEffect.create({
        data: {
          userId: demo.id,
          date: ds(se.db),
          medicationId: se.mid,
          medicationName: se.mn,
          description: se.desc,
          severity: se.sev as any,
          notes: se.note,
        },
      }).catch(() => {});
    }

    // ── Outros pacientes (para painel admin ter mais pacientes) ───────────
    const p2 = await prisma.user.upsert({
      where: { email: 'paciente@nerva.test' },
      update: { passwordHash: password, emailVerified: true },
      create: { email: 'paciente@nerva.test', passwordHash: password, fullName: 'Carlos Eduardo Silva', role: 'user', profile: 'patient', emailVerified: true, provider: 'local', language: 'pt' },
    });
    const p3 = await prisma.user.upsert({
      where: { email: 'paciente2@nerva.test' },
      update: { passwordHash: password, emailVerified: true },
      create: { email: 'paciente2@nerva.test', passwordHash: password, fullName: 'Mariana Costa', role: 'user', profile: 'patient', emailVerified: true, provider: 'local' },
    });
    await prisma.user.upsert({
      where: { email: 'rosasimone09@gmail.com' },
      update: { emailVerified: true },
      create: { email: 'rosasimone09@gmail.com', role: 'user', profile: 'patient', emailVerified: true, provider: 'local', passwordHash: password },
    });

    // Dados mínimos p2 e p3 para aparecer no painel admin
    for (const [pat, medName, medId, color, adh] of [
      [p2, 'Lamotrigina', 'demo-p2-lamo', 'amber', 0.82],
      [p3, 'Fenobarbital', 'demo-p3-feno', 'rose', 0.70],
    ] as const) {
      const m = await prisma.medication.upsert({
        where: { id: medId },
        update: {},
        create: { id: medId, userId: (pat as any).id, name: medName as string, dosage: '100mg', frequency: '1x ao dia', times: ['08:00'], color: color as string, active: true },
      });
      for (let i = 45; i >= 1; i--) {
        const date = ds(i);
        const taken = Math.random() < (adh as number);
        await prisma.doseLog.upsert({
          where: { uniq_scheduled_dose: { userId: (pat as any).id, medicationId: m.id, scheduledDate: date, scheduledTime: '08:00' } },
          update: {},
          create: { userId: (pat as any).id, medicationId: m.id, medicationName: medName as string, scheduledDate: date, scheduledTime: '08:00', status: taken ? 'taken' : 'missed', takenAt: taken ? new Date(`${date}T08:00:00`) : null },
        });
      }
      // Crises para aparecer no painel
      await prisma.seizure.create({
        data: { userId: (pat as any).id, dateTime: dt(20, 10), type: 'focal', durationMinutes: 1, severity: 'mild', triggers: [], notes: '' },
      }).catch(() => {});
    }

    res.json({
      ok: true,
      message: '6 meses de dados realistas criados com sucesso.',
      contas: {
        admin: { email: adminEmail, senha: 'Password123' },
        paciente_demo: { email: 'larissa.rafaela.aluno@unifacvest.edu.br', senha: 'Password123', nome: 'Ana Clara Oliveira' },
        paciente2: { email: 'paciente@nerva.test', senha: 'Password123' },
        paciente3: { email: 'paciente2@nerva.test', senha: 'Password123' },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0, 5) });
  }
});

export default router;
