# 🏗️ Микросервисная архитектура Asterisk PJSIP Monitor

## 📋 Обзор архитектуры

Проект разделен на два независимых сервиса:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│   Backend API   │◄──►│    Asterisk     │
│   (React/Vite)  │    │   (Node.js)     │    │     (AMI)       │
│   localhost:3000│    │   server:3001   │    │   server:5038   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 Backend API (Node.js)
- **Порт:** 3001
- **Функции:** REST API, WebSocket, AMI интеграция, работа с файлами
- **Технологии:** Express, Socket.IO, Asterisk Manager

### 🎨 Frontend (React)
- **Порт:** 3000 (dev), статические файлы (prod)
- **Функции:** Пользовательский интерфейс, реальное время
- **Технологии:** React, Vite, Tailwind CSS, CodeMirror

## 🚀 Быстрый старт

### 1. Backend API

```bash
# Переход в директорию backend
cd backend

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Запуск в продакшне
npm start

# Тестовый режим (с симуляцией)
npm run test
```

### 2. Frontend

```bash
# Переход в директорию frontend
cd frontend

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для продакшна
npm run build

# Предварительный просмотр сборки
npm run preview
```

## 🔄 Режимы работы

### Разработка (Development)

**Backend (тестовый режим):**
```bash
cd backend && npm run test
```
- Симуляция AMI событий
- Тестовые данные
- Порт: 3001

**Frontend:**
```bash
cd frontend && npm run dev
```
- Hot reload
- Proxy к backend API
- Порт: 3000

**Доступ:** http://localhost:3000

### Продакшн на сервере

**Backend (боевой режим):**
```bash
cd backend && npm start
```
- Реальное подключение к AMI
- Работа с файлами Asterisk
- Порт: 3001

**Frontend (сборка):**
```bash
cd frontend && npm run build
```
- Статические файлы в `dist/`
- Оптимизированная сборка
- Подача через nginx/apache

## 🌐 API Endpoints

### Секции PJSIP
- `GET /api/sections` - Получить все секции
- `GET /api/sections/:name` - Получить секцию
- `POST /api/sections` - Создать секцию
- `PUT /api/sections/:name` - Обновить секцию
- `DELETE /api/sections/:name` - Удалить секцию

### Мониторинг
- `GET /api/status` - Статус мониторинга
- `GET /api/logs/:section` - Логи секции

### WebSocket события
- `ami_status` - Статус AMI подключения
- `endpoint_status` - Статус endpoint'а
- `new_log` - Новый лог

## ⚙️ Конфигурация

### Backend (.env)
```env
PORT=3001
PJSIP_CONFIG=/etc/asterisk/pjsip.conf
LOG_DIR=/var/log/asterisk
AMI_HOST=localhost
AMI_PORT=5038
AMI_USER=admin
AMI_PASS=your_password
```

### Frontend (.env)
```env
VITE_API_URL=http://your-server:3001
```

## 🐳 Docker развертывание

### Backend Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Frontend Dockerfile
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    volumes:
      - /etc/asterisk:/etc/asterisk:ro
      - /var/log/asterisk:/var/log/asterisk:ro

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

## 🔧 Развертывание на сервере

### Вариант 1: Отдельные процессы

**Backend на сервере:**
```bash
# На сервере с Asterisk
git clone <repo>
cd asterisk-pjsip-monitor/backend
npm install --production
npm start
```

**Frontend локально:**
```bash
# На машине разработчика
cd frontend
echo "VITE_API_URL=http://your-server:3001" > .env
npm run dev
```

### Вариант 2: Полное развертывание

```bash
# Сборка frontend
cd frontend
npm run build

# Копирование на сервер
scp -r dist/ user@server:/var/www/asterisk-monitor/

# Настройка nginx
server {
    listen 80;
    root /var/www/asterisk-monitor;
    
    location /api {
        proxy_pass http://localhost:3001;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🔍 Отладка

### Backend логи
```bash
# Просмотр логов
journalctl -u asterisk-monitor -f

# Проверка API
curl http://localhost:3001/api/status

# Проверка WebSocket
wscat -c ws://localhost:3001
```

### Frontend отладка
```bash
# Проверка сборки
npm run build && npm run preview

# Анализ bundle
npm run build -- --analyze
```

## 📊 Мониторинг

### Метрики backend
- Статус AMI подключения
- Количество активных WebSocket соединений
- Время ответа API
- Использование памяти

### Метрики frontend
- Время загрузки
- Размер bundle
- Производительность рендеринга

## 🔒 Безопасность

### Backend
- CORS настройки
- Rate limiting
- Валидация входных данных
- Безопасные заголовки

### Frontend
- CSP заголовки
- XSS защита
- Безопасные cookies
- HTTPS в продакшне

## 🚀 Преимущества архитектуры

1. **Независимая разработка** - frontend и backend развиваются отдельно
2. **Гибкое развертывание** - можно развернуть только backend на сервере
3. **Масштабируемость** - легко добавить load balancer
4. **Технологическая свобода** - можно заменить frontend на другую технологию
5. **Простота отладки** - изолированные компоненты

## 📝 Следующие шаги

1. Добавить аутентификацию JWT
2. Реализовать кэширование Redis
3. Добавить метрики Prometheus
4. Настроить CI/CD pipeline
5. Добавить тесты (Jest, Cypress) 