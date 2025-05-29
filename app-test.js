const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('basic-auth');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 8080;
const AST_FILE = path.join(__dirname, 'test-pjsip.conf'); // Используем локальный тестовый файл

// HTTP Basic Auth credentials
const USERS = { admin: 'secret123' }; // change password

// Setup view engine for EJS templates
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public')); // Для статических файлов

// Store for SIP endpoints status (симуляция для тестирования)
const endpointsStatus = new Map();
const activeCalls = new Map();

// Симуляция статусов для демонстрации
function initializeTestData() {
  // Добавляем тестовые статусы
  endpointsStatus.set('test1', {
    endpoint: 'test1-ep',
    status: 'Reachable',
    lastUpdate: new Date().toISOString()
  });
  
  endpointsStatus.set('example2', {
    endpoint: 'example2-ep', 
    status: 'Unreachable',
    lastUpdate: new Date().toISOString()
  });
  
  // Симулируем периодические обновления
  setInterval(() => {
    simulateStatusUpdates();
  }, 10000); // каждые 10 секунд
  
  // Симулируем логи
  setInterval(() => {
    simulateLogEntry();
  }, 3000); // каждые 3 секунды
}

function simulateStatusUpdates() {
  const sections = ['test1', 'example2'];
  const statuses = ['Reachable', 'Unreachable', 'Unknown'];
  
  sections.forEach(section => {
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    endpointsStatus.set(section, {
      endpoint: `${section}-ep`,
      status: randomStatus,
      lastUpdate: new Date().toISOString()
    });
    
    // Иногда симулируем звонки
    if (Math.random() < 0.3) {
      const callId = `call-${Date.now()}-${Math.random()}`;
      activeCalls.set(callId, {
        endpoint: section,
        state: 'Up',
        channel: `PJSIP/${section}-000001`,
        callerid: '+1234567890',
        timestamp: new Date().toISOString()
      });
      
      // Завершаем звонок через 30-60 секунд
      setTimeout(() => {
        activeCalls.delete(callId);
        io.emit('statusUpdate', {
          endpoints: Array.from(endpointsStatus.entries()),
          calls: Array.from(activeCalls.entries())
        });
      }, 30000 + Math.random() * 30000);
    }
  });
  
  // Отправляем обновления клиентам
  io.emit('statusUpdate', {
    endpoints: Array.from(endpointsStatus.entries()),
    calls: Array.from(activeCalls.entries())
  });
}

function simulateLogEntry() {
  const sections = ['test1', 'example2'];
  const logTypes = [
    'Registration attempt',
    'Call initiated',
    'Call terminated',
    'Authentication success',
    'Authentication failed',
    'Endpoint status change'
  ];
  const levels = ['NOTICE', 'WARNING', 'ERROR', 'DEBUG'];
  
  const section = sections[Math.floor(Math.random() * sections.length)];
  const logType = logTypes[Math.floor(Math.random() * logTypes.length)];
  const level = levels[Math.floor(Math.random() * levels.length)];
  
  const logMessage = `[res_pjsip] ${level}: ${logType} for endpoint ${section}-ep from 192.168.1.100:5060`;
  
  io.emit('logUpdate', {
    timestamp: new Date().toISOString(),
    message: logMessage,
    file: 'full'
  });
}

// Basic HTTP authentication middleware
app.use((req, res, next) => {
  const user = basicAuth(req);
  if (!user || USERS[user.name] !== user.pass) {
    res.set('WWW-Authenticate', 'Basic realm="Asterisk Editor"');
    return res.status(401).send('Authorization required.');
  }
  next();
});

// Utility: escape string for RegExp
function escapeForRegExp(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Utility: parse sections marked by ;--- NAME --- and ;/--- NAME ---
function getSections(configText) {
  const sectionRegex = /;---\s*(.+?)\s*---[\r\n]+([\s\S]*?)[\r\n]+;\/---\s*\1\s*---/g;
  let match;
  const sections = [];
  while ((match = sectionRegex.exec(configText)) !== null) {
    sections.push({ name: match[1], content: match[2] });
  }
  return sections;
}

// Route: list sections with monitoring
app.get('/', (req, res) => {
  fs.readFile(AST_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Read error: ' + err.message);
    const sections = getSections(data);
    
    // Добавляем статус к каждой секции
    const sectionsWithStatus = sections.map(section => {
      const status = endpointsStatus.get(section.name) || { status: 'Unknown' };
      const calls = Array.from(activeCalls.values()).filter(call => 
        call.endpoint.startsWith(section.name)
      );
      
      return {
        ...section,
        registrationStatus: status.status,
        hasActiveCalls: calls.length > 0,
        callsCount: calls.length,
        lastUpdate: status.lastUpdate
      };
    });
    
    res.render('index', { sections: sectionsWithStatus });
  });
});

// Route: new section form
app.get('/new', (req, res) => {
  res.render('new');
});

// Route: create new section
app.post('/new', (req, res) => {
  const secName = req.body.name.trim();
  const newContent = req.body.content;
  if (!secName) return res.status(400).send('Section name is required');
  const markerOpen = `;--- ${secName} ---`;
  const markerClose = `;/--- ${secName} ---`;
  const sectionText = `\n${markerOpen}\n${newContent}\n${markerClose}\n`;
  // Append to file
  fs.appendFile(AST_FILE, sectionText, 'utf8', err => {
    if (err) return res.status(500).send('Append error: ' + err.message);
    // В тестовом режиме не перезагружаем Asterisk
    console.log('New section created:', secName);
    
    // Добавляем новую секцию в мониторинг
    endpointsStatus.set(secName, {
      endpoint: `${secName}-ep`,
      status: 'Unknown',
      lastUpdate: new Date().toISOString()
    });
    
    res.redirect('/');
  });
});

// Route: edit specific section
app.get('/edit/:section', (req, res) => {
  const secName = req.params.section;
  fs.readFile(AST_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Read error: ' + err.message);
    const sections = getSections(data);
    const section = sections.find(s => s.name === secName);
    if (!section) return res.status(404).send('Section not found');
    res.render('edit', { name: section.name, content: section.content });
  });
});

// Route: save updated section only
app.post('/save/:section', (req, res) => {
  const secName = req.params.section;
  const newContent = req.body.content;
  const nameEsc = escapeForRegExp(secName);
  fs.readFile(AST_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Read error: ' + err.message);
    const sectionRegex = new RegExp(
      `(;---\\s*${nameEsc}\\s*---)[\\r\\n]+([\\s\\S]*?)[\\r\\n]+(;\\/---\\s*${nameEsc}\\s*---)`
    );
    const updated = data.replace(sectionRegex, (m, open, oldBody, close) => {
      return `${open}\n${newContent}\n${close}`;
    });
    fs.writeFile(AST_FILE, updated, 'utf8', err2 => {
      if (err2) return res.status(500).send('Write error: ' + err2.message);
      // В тестовом режиме не перезагружаем Asterisk
      console.log('Section updated:', secName);
      res.redirect('/');
    });
  });
});

// Route: logs page for specific section
app.get('/logs/:section', (req, res) => {
  const secName = req.params.section;
  res.render('logs', { sectionName: secName });
});

// API: Get current status
app.get('/api/status', (req, res) => {
  res.json({
    endpoints: Array.from(endpointsStatus.entries()),
    calls: Array.from(activeCalls.entries()),
    amiConnected: true // В тестовом режиме всегда подключен
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Отправляем текущий статус новому клиенту
  socket.emit('statusUpdate', {
    endpoints: Array.from(endpointsStatus.entries()),
    calls: Array.from(activeCalls.entries())
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
  
  // Подписка на логи конкретной секции
  socket.on('subscribeLogs', (sectionName) => {
    socket.join(`logs-${sectionName}`);
    console.log(`Client subscribed to logs for section: ${sectionName}`);
  });
  
  socket.on('unsubscribeLogs', (sectionName) => {
    socket.leave(`logs-${sectionName}`);
    console.log(`Client unsubscribed from logs for section: ${sectionName}`);
  });
  
  socket.on('requestUpdate', () => {
    socket.emit('statusUpdate', {
      endpoints: Array.from(endpointsStatus.entries()),
      calls: Array.from(activeCalls.entries())
    });
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server listening on port ${PORT}`);
  console.log(`📊 Monitoring interface: http://localhost:${PORT}`);
  console.log(`🧪 Using test config file: ${AST_FILE}`);
  console.log(`🔑 Login: admin, Password: secret123`);
  
  // Инициализация тестовых данных
  initializeTestData();
}); 