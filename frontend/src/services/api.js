import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptors для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const sectionsAPI = {
  // Получить все секции
  getAll: () => api.get('/api/sections'),
  
  // Получить конкретную секцию
  getById: (name) => api.get(`/api/sections/${name}`),
  
  // Создать новую секцию
  create: (data) => api.post('/api/sections', data),
  
  // Обновить секцию
  update: (name, data) => api.put(`/api/sections/${name}`, data),
  
  // Удалить секцию
  delete: (name) => api.delete(`/api/sections/${name}`),
};

export const monitoringAPI = {
  // Получить статус мониторинга
  getStatus: () => api.get('/api/status'),
  
  // Получить логи для секции
  getLogs: (section) => api.get(`/api/logs/${section}`),
};

export default api; 