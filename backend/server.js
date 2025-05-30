const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');
const { Tail } = require('tail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"], // React/Vite dev servers
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

// Конфигурация
const CONFIG = {
  port: process.env.PORT || 3001,
  pjsipConfigFile: process.env.PJSIP_CONFIG || '/etc/asterisk/pjsip.conf',
  logDir: process.env.LOG_DIR || '/var/log/asterisk',
  ami: {
    port: process.env.AMI_PORT || 5038,
    host: process.env.AMI_HOST || 'localhost',
    username: process.env.AMI_USER || 'admin',
    password: process.env.AMI_PASS || 'amp111',
    events: 'on'
  }
};

// Состояние мониторинга
let monitoringState = {
  endpoints: new Map(),
  activeCalls: new Map(),
  amiConnected: false,
  lastUpdate: new Date()
};

// AMI подключение
let ami = null;

function connectAMI() {
  try {
    ami = new AsteriskManager(
      CONFIG.ami.port,
      CONFIG.ami.host,
      CONFIG.ami.username,
      CONFIG.ami.password,
      true
    );

    ami.on('connect', () => {
      console.log('✅ AMI Connected');
      monitoringState.amiConnected = true;
      io.emit('ami_status', { connected: true });
      
      // Запрос начального статуса
      requestEndpointStatus();
    });

    ami.on('disconnect', () => {
      console.log('❌ AMI Disconnected');
      monitoringState.amiConnected = false;
      io.emit('ami_status', { connected: false });
    });

    ami.on('error', (err) => {
      console.error('AMI Error:', err.message);
      monitoringState.amiConnected = false;
    });

    // Обработка событий регистрации
    ami.on('contactstatus', (event) => {
      if (event.contactstatus) {
        const endpointName = event.uri ? event.uri.split('@')[0].replace('sip:', '') : 'unknown';
        const status = event.contactstatus.toLowerCase() === 'reachable' ? 'online' : 'offline';
        
        updateEndpointStatus(endpointName, status);
      }
    });

    // Обработка событий звонков
    ami.on('newchannel', (event) => {
      if (event.channel && event.channel.includes('PJSIP/')) {
        const endpoint = extractEndpointFromChannel(event.channel);
        if (endpoint) {
          addActiveCall(endpoint, event.channel);
        }
      }
    });

    ami.on('hangup', (event) => {
      if (event.channel && event.channel.includes('PJSIP/')) {
        const endpoint = extractEndpointFromChannel(event.channel);
        if (endpoint) {
          removeActiveCall(endpoint, event.channel);
        }
      }
    });

  } catch (error) {
    console.error('Failed to connect to AMI:', error.message);
    monitoringState.amiConnected = false;
  }
}

function extractEndpointFromChannel(channel) {
  const match = channel.match(/PJSIP\/([^-\/]+)/);
  return match ? match[1] : null;
}

function updateEndpointStatus(endpoint, status) {
  monitoringState.endpoints.set(endpoint, {
    status,
    lastSeen: new Date(),
    calls: monitoringState.activeCalls.get(endpoint) || 0
  });
  
  io.emit('endpoint_status', {
    endpoint,
    status,
    calls: monitoringState.activeCalls.get(endpoint) || 0
  });
}

function addActiveCall(endpoint, channel) {
  const currentCalls = monitoringState.activeCalls.get(endpoint) || 0;
  monitoringState.activeCalls.set(endpoint, currentCalls + 1);
  
  updateEndpointStatus(endpoint, monitoringState.endpoints.get(endpoint)?.status || 'unknown');
}

function removeActiveCall(endpoint, channel) {
  const currentCalls = monitoringState.activeCalls.get(endpoint) || 0;
  const newCalls = Math.max(0, currentCalls - 1);
  monitoringState.activeCalls.set(endpoint, newCalls);
  
  updateEndpointStatus(endpoint, monitoringState.endpoints.get(endpoint)?.status || 'unknown');
}

function requestEndpointStatus() {
  if (ami && monitoringState.amiConnected) {
    ami.action({
      action: 'PJSIPShowEndpoints'
    }, (err, res) => {
      if (err) {
        console.error('Error requesting endpoint status:', err);
      }
    });
  }
}

// API Routes

// Получить все секции
app.get('/api/sections', (req, res) => {
  try {
    const sections = readPJSIPSections();
    res.json({ success: true, sections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить конкретную секцию
app.get('/api/sections/:name', (req, res) => {
  try {
    const sections = readPJSIPSections();
    const section = sections.find(s => s.name === req.params.name);
    
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, section });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Создать новую секцию
app.post('/api/sections', (req, res) => {
  try {
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content are required' });
    }
    
    addPJSIPSection(name, content);
    res.json({ success: true, message: 'Section created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить секцию
app.put('/api/sections/:name', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    updatePJSIPSection(req.params.name, content);
    res.json({ success: true, message: 'Section updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить секцию
app.delete('/api/sections/:name', (req, res) => {
  try {
    deletePJSIPSection(req.params.name);
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
  try {
    const logs = getLogsForSection(req.params.section);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Функции работы с PJSIP конфигурацией
function readPJSIPSections() {
  try {
    const content = fs.readFileSync(CONFIG.pjsipConfigFile, 'utf8');
    const sections = [];
    const lines = content.split('\n');
    
    let currentSection = null;
    let inSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Начало секции
      if (line.match(/^;--- (.+) ---$/)) {
        const name = line.match(/^;--- (.+) ---$/)[1];
        currentSection = {
          name,
          content: '',
          startLine: i,
          endLine: -1
        };
        inSection = true;
        continue;
      }
      
      // Конец секции
      if (line.match(/^;\/--- (.+) ---$/)) {
        if (currentSection) {
          currentSection.endLine = i;
          sections.push(currentSection);
        }
        inSection = false;
        currentSection = null;
        continue;
      }
      
      // Содержимое секции
      if (inSection && currentSection) {
        currentSection.content += lines[i] + '\n';
      }
    }
    
    return sections;
  } catch (error) {
    throw new Error(`Failed to read PJSIP config: ${error.message}`);
  }
}

function addPJSIPSection(name, content) {
  const sectionText = `;--- ${name} ---\n${content}\n;/--- ${name} ---\n\n`;
  fs.appendFileSync(CONFIG.pjsipConfigFile, sectionText);
  reloadAsterisk();
}

function updatePJSIPSection(name, newContent) {
  const sections = readPJSIPSections();
  const section = sections.find(s => s.name === name);
  
  if (!section) {
    throw new Error('Section not found');
  }
  
  const content = fs.readFileSync(CONFIG.pjsipConfigFile, 'utf8');
  const lines = content.split('\n');
  
  // Заменяем содержимое секции
  const newLines = [
    ...lines.slice(0, section.startLine + 1),
    ...newContent.split('\n'),
    ...lines.slice(section.endLine)
  ];
  
  fs.writeFileSync(CONFIG.pjsipConfigFile, newLines.join('\n'));
  reloadAsterisk();
}

function deletePJSIPSection(name) {
  const sections = readPJSIPSections();
  const section = sections.find(s => s.name === name);
  
  if (!section) {
    throw new Error('Section not found');
  }
  
  const content = fs.readFileSync(CONFIG.pjsipConfigFile, 'utf8');
  const lines = content.split('\n');
  
  // Удаляем секцию
  const newLines = [
    ...lines.slice(0, section.startLine),
    ...lines.slice(section.endLine + 1)
  ];
  
  fs.writeFileSync(CONFIG.pjsipConfigFile, newLines.join('\n'));
  reloadAsterisk();
}

function reloadAsterisk() {
  const { exec } = require('child_process');
  exec('sudo systemctl reload asterisk', (error) => {
    if (error) {
      console.error('Failed to reload Asterisk:', error.message);
    } else {
      console.log('✅ Asterisk reloaded');
    }
  });
}

function getLogsForSection(section) {
  // Заглушка для логов - в реальности здесь будет чтение файлов логов
  return [
    { timestamp: new Date(), level: 'INFO', message: `Sample log for ${section}` }
  ];
}

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
  console.log(`🚀 Backend API server listening on port ${CONFIG.port}`);
  console.log(`📊 API endpoints: http://localhost:${CONFIG.port}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${CONFIG.port}`);
  
  // Подключение к AMI
  connectAMI();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  if (ami) {
    ami.disconnect();
  }
  server.close(() => {
    console.log('✅ Backend server closed');
    process.exit(0);
  });
}); 