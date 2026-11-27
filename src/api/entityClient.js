import { http } from './httpClient';

export function createEntityClient(resource) {
  const base = `/${resource}`;
  return {
    list(sort, limit) {
      return http.get(base, { query: { sort, limit } });
    },
    filter(query, sort, limit) {
      return http.get(base, { query: { filter: query, sort, limit } });
    },
    get(id) {
      return http.get(`${base}/${id}`);
    },
    create(data) {
      return http.post(base, data);
    },
    bulkCreate(items) {
      return http.post(`${base}/bulk`, items);
    },
    update(id, data) {
      return http.patch(`${base}/${id}`, data);
    },
    bulkUpdate(items) {
      return http.patch(`${base}/bulk`, items);
    },
    delete(id) {
      return http.delete(`${base}/${id}`);
    },
    deleteMany(filter) {
      return http.post(`${base}/delete-many`, { filter });
    },
  };
}
