import { createEntityClient } from './entityClient';
import { authClient } from './authClient';
import { http } from './httpClient';

export const base44 = {
  entities: {
    User: {
      list: async (sort, limit) => http.get('/users', { query: { sort, limit } }),
    },
    Medication: createEntityClient('medications'),
    DoseLog: createEntityClient('dose-logs'),
    Seizure: createEntityClient('seizures'),
    SideEffect: createEntityClient('side-effects'),
    SleepRecord: createEntityClient('sleep-records'),
  },
  doses: {
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
