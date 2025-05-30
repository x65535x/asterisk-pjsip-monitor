const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());

const CONFIG = {
  port: process.env.PORT || 3001,
  testConfigFile: path.join(__dirname, 'test-pjsip.conf')
};

// Тестовые данные
let testSections = [
  {
    name: 'office_phone_101',
    content: `[101]
type = endpoint
context = internal
disallow = all
allow = ulaw,alaw
auth = 101
aors = 101

[101]
type = auth
auth_type = userpass
password = secret123
username = 101

[101]
type = aor
max_contacts = 1
contact = sip:101@192.168.1.101:5060`
  },
  {
    name: 'office_phone_102',
    content: `[102]
type = endpoint
context = internal
disallow = all
allow = ulaw,alaw
auth = 102
aors = 102

[102]
type = auth
auth_type = userpass
password = secret456
username = 102

[102]
type = aor
max_contacts = 1
contact = sip:102@192.168.1.102:5060`
  },
  {
    name: 'conference_room',
    content: `[conference]
type = endpoint
context = conferences
disallow = all
allow = ulaw,alaw,g722
auth = conference
aors = conference

[conference]
type = auth
auth_type = userpass
password = conf2023
username = conference

[conference]
type = aor
max_contacts = 5`
  }
];

// Состояние мониторинга
let monitoringState = {
  endpoints: new Map([
    ['101', { status: 'online', lastSeen: new Date(), calls: 0 }],
    ['102', { status: 'offline', lastSeen: new Date(Date.now() - 300000), calls: 0 }],
    ['conference', { status: 'online', lastSeen: new Date(), calls: 0 }]
  ]),
  activeCalls: new Map(),
  amiConnected: true,
  lastUpdate: new Date()
};

// Симуляция изменений статуса
function simulateStatusChanges() {
  setInterval(() => {
    const endpoints = Array.from(monitoringState.endpoints.keys());
    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const currentStatus = monitoringState.endpoints.get(randomEndpoint);
    
    // Случайно меняем статус
    if (Math.random() < 0.3) {
      const newStatus = currentStatus.status === 'online' ? 'offline' : 'online';
      monitoringState.endpoints.set(randomEndpoint, {
        ...currentStatus,
        status: newStatus,
        lastSeen: new Date()
      });
      
      io.emit('endpoint_status', {
        endpoint: randomEndpoint,
        status: newStatus,
        calls: monitoringState.activeCalls.get(randomEndpoint) || 0
      });
      
      console.log(`📊 Status changed: ${randomEndpoint} -> ${newStatus}`);
    }
  }, 10000); // Каждые 10 секунд
}

// Симуляция звонков
function simulateCalls() {
  setInterval(() => {
    const endpoints = Array.from(monitoringState.endpoints.keys());
    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    if (Math.random() < 0.2) { // 20% шанс звонка
      const currentCalls = monitoringState.activeCalls.get(randomEndpoint) || 0;
      const newCalls = currentCalls + 1;
      monitoringState.activeCalls.set(randomEndpoint, newCalls);
      
      io.emit('endpoint_status', {
        endpoint: randomEndpoint,
        status: monitoringState.endpoints.get(randomEndpoint).status,
        calls: newCalls
      });
      
      console.log(`📞 Call started: ${randomEndpoint} (${newCalls} active)`);
      
      // Завершаем звонок через случайное время
      setTimeout(() => {
        const calls = Math.max(0, (monitoringState.activeCalls.get(randomEndpoint) || 1) - 1);
        monitoringState.activeCalls.set(randomEndpoint, calls);
        
        io.emit('endpoint_status', {
          endpoint: randomEndpoint,
          status: monitoringState.endpoints.get(randomEndpoint).status,
          calls: calls
        });
        
        console.log(`📞 Call ended: ${randomEndpoint} (${calls} active)`);
      }, Math.random() * 30000 + 5000); // 5-35 секунд
    }
  }, 15000); // Каждые 15 секунд
}

// Симуляция логов
function simulateLogs() {
  const logLevels = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
  const logSources = ['PJSIP', 'res_pjsip', 'app_dial', 'chan_pjsip'];
  const logMessages = [
    'Endpoint registered successfully',
    'Authentication failed for endpoint',
    'Call established',
    'Call terminated',
    'Network connectivity issue',
    'Configuration reloaded',
    'Codec negotiation completed',
    'RTP stream established'
  ];
  
  setInterval(() => {
    const sections = testSections.map(s => s.name);
    const randomSection = sections[Math.floor(Math.random() * sections.length)];
    const randomLevel = logLevels[Math.floor(Math.random() * logLevels.length)];
    const randomSource = logSources[Math.floor(Math.random() * logSources.length)];
    const randomMessage = logMessages[Math.floor(Math.random() * logMessages.length)];
    
    const logEntry = {
      timestamp: new Date(),
      level: randomLevel,
      source: randomSource,
      message: `[${randomSection}] ${randomMessage}`
    };
    
    io.to(`logs_${randomSection}`).emit('new_log', logEntry);
  }, 3000); // Каждые 3 секунды
}

// API Routes

// Получить все секции
app.get('/api/sections', (req, res) => {
  res.json({ success: true, sections: testSections });
});

// Получить конкретную секцию
app.get('/api/sections/:name', (req, res) => {
  const section = testSections.find(s => s.name === req.params.name);
  
  if (!section) {
    return res.status(404).json({ success: false, error: 'Section not found' });
  }
  
  res.json({ success: true, section });
});

// Создать новую секцию
app.post('/api/sections', (req, res) => {
  const { name, content } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({ success: false, error: 'Name and content are required' });
  }
  
  // Проверяем, что секция не существует
  if (testSections.find(s => s.name === name)) {
    return res.status(409).json({ success: false, error: 'Section already exists' });
  }
  
  testSections.push({ name, content });
  
  // Добавляем в мониторинг
  monitoringState.endpoints.set(name, {
    status: 'unknown',
    lastSeen: new Date(),
    calls: 0
  });
  
  console.log(`✅ Section created: ${name}`);
  res.json({ success: true, message: 'Section created successfully' });
});

// Обновить секцию
app.put('/api/sections/:name', (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ success: false, error: 'Content is required' });
  }
  
  const sectionIndex = testSections.findIndex(s => s.name === req.params.name);
  
  if (sectionIndex === -1) {
    return res.status(404).json({ success: false, error: 'Section not found' });
  }
  
  testSections[sectionIndex].content = content;
  
  console.log(`✅ Section updated: ${req.params.name}`);
  res.json({ success: true, message: 'Section updated successfully' });
});

// Удалить секцию
app.delete('/api/sections/:name', (req, res) => {
  const sectionIndex = testSections.findIndex(s => s.name === req.params.name);
  
  if (sectionIndex === -1) {
    return res.status(404).json({ success: false, error: 'Section not found' });
  }
  
  testSections.splice(sectionIndex, 1);
  
  // Удаляем из мониторинга
  monitoringState.endpoints.delete(req.params.name);
  monitoringState.activeCalls.delete(req.params.name);
  
  console.log(`✅ Section deleted: ${req.params.name}`);
  res.json({ success: true, message: 'Section deleted successfully' });
});

// Получить статус мониторинга
app.get('/api/status', (req, res) => {
  const status = {};
  
  for (const [endpoint, data] of monitoringState.endpoints) {
    status[endpoint] = {
      status: data.status,
      calls: monitoringState.activeCalls.get(endpoint) || 0,
      lastSeen: data.lastSeen
    };
  }
  
  res.json({
    success: true,
    amiConnected: monitoringState.amiConnected,
    lastUpdate: monitoringState.lastUpdate,
    endpoints: status
  });
});

// Получить логи для секции
app.get('/api/logs/:section', (req, res) => {
  // Возвращаем последние 50 тестовых логов
  const logs = Array.from({ length: 50 }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 60000),
    level: ['INFO', 'WARNING', 'ERROR', 'DEBUG'][Math.floor(Math.random() * 4)],
    source: ['PJSIP', 'res_pjsip', 'app_dial'][Math.floor(Math.random() * 3)],
    message: `Test log entry ${i + 1} for ${req.params.section}`
  })).reverse();
  
  res.json({ success: true, logs });
});

// WebSocket обработка
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Отправляем текущий статус при подключении
  socket.emit('ami_status', { connected: monitoringState.amiConnected });
  
  // Отправляем статус всех endpoints
  for (const [endpoint, data] of monitoringState.endpoints) {
    socket.emit('endpoint_status', {
      endpoint,
      status: data.status,
      calls: monitoringState.activeCalls.get(endpoint) || 0
    });
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  socket.on('subscribe_logs', (section) => {
    socket.join(`logs_${section}`);
    console.log(`Client subscribed to logs for section: ${section}`);
  });
  
  socket.on('unsubscribe_logs', (section) => {
    socket.leave(`logs_${section}`);
    console.log(`Client unsubscribed from logs for section: ${section}`);
  });
});

// Запуск сервера
server.listen(CONFIG.port, () => {
  console.log(`🚀 Test Backend API server listening on port ${CONFIG.port}`);
  console.log(`📊 API endpoints: http://localhost:${CONFIG.port}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${CONFIG.port}`);
  console.log(`🧪 Test mode: Simulating AMI and log data`);
  
  // Запуск симуляций
  simulateStatusChanges();
  simulateCalls();
  simulateLogs();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test backend server...');
  server.close(() => {
    console.log('✅ Test backend server closed');
    process.exit(0);
  });
}); 