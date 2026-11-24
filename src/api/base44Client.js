// Cliente do NERVA. Mantém a MESMA superfície do antigo SDK (base44.entities.*,
// base44.auth.*, base44.app.*) para não exigir mudanças nas telas, mas agora
// fala com o backend próprio (Express + Prisma + PostgreSQL) via REST.
import { createEntityClient } from './entityClient';
import { authClient } from './authClient';
import { http } from './httpClient';

export const base44 = {
  entities: {
    User: {
      // No admin (Patients.jsx) lista todos os usuários; caso contrário retorna o próprio.
      list: async (sort, limit) => http.get('/users', { query: { sort, limit } }),
    },
    Medication: createEntityClient('medications'),
    DoseLog: createEntityClient('dose-logs'),
    Seizure: createEntityClient('seizures'),
    SideEffect: createEntityClient('side-effects'),
    SleepRecord: createEntityClient('sleep-records'),
  },

  // Endpoint dedicado de doses — geração server-side + adesão.
  doses: {
    // Retorna (e gera se necessário) as doses de uma data. date = 'YYYY-MM-DD'.
    getToday(date) {
      return http.get('/doses', { query: { date } });
    },
    getAdherence(days) {
      return http.get('/doses/adherence', { query: { days } });
    },
    take(id) {
      return http.post(`/doses/${id}/take`, {});
    },
    skip(id) {
      return http.post(`/doses/${id}/skip`, {});
    },
  },

  // Endpoints administrativos — retornam dados de TODOS os pacientes.
  admin: {
    getPatients() {
      return http.get('/admin/patients');
    },
    getPatient(id) {
      return http.get(`/admin/patients/${id}`);
    },
    getEpidemiology() {
      return http.get('/admin/epidemiology');
    },
  },

  auth: authClient,
  app: {
    async getPublicSettings() {
      return http.get('/app/public-settings', { auth: false });
    },
  },
};

export default base44;
