const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('basic-auth');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');
const AsteriskManager = require('asterisk-manager');
const { Tail } = require('tail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 8080;
const AST_FILE = '/etc/asterisk/pjsip.conf';

// Asterisk AMI Configuration
const AMI_CONFIG = {
  port: 5038,
  host: 'localhost',
  username: 'admin', // Настройте в /etc/asterisk/manager.conf
  password: 'secret', // Настройте в /etc/asterisk/manager.conf
  events: 'on'
};

// HTTP Basic Auth credentials
const USERS = { admin: 'secret123' }; // change password

// Setup view engine for EJS templates
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public')); // Для статических файлов

// Store for SIP endpoints status
const endpointsStatus = new Map();
const activeCalls = new Map();

// Asterisk Manager Connection
let ami = null;
let logTail = null;

function connectAMI() {
  try {
    ami = new AsteriskManager(AMI_CONFIG.port, AMI_CONFIG.host, AMI_CONFIG.username, AMI_CONFIG.password, true);
    
    ami.on('connect', () => {
      console.log('✅ AMI Connected');
      // Запрос текущих endpoints
      refreshEndpointsStatus();
    });

    ami.on('disconnect', () => {
      console.log('❌ AMI Disconnected');
      setTimeout(connectAMI, 5000); // Переподключение через 5 сек
    });

    ami.on('error', (err) => {
      console.error('AMI Error:', err.message);
    });

    // Мониторинг событий регистрации
    ami.on('managerevent', (evt) => {
      handleAMIEvent(evt);
    });

  } catch (error) {
    console.error('Failed to connect AMI:', error.message);
    console.log('🔄 Will retry AMI connection in 10 seconds...');
    setTimeout(connectAMI, 10000);
  }
}

function handleAMIEvent(evt) {
  const eventName = evt.event;
  
  switch (eventName) {
    case 'ContactStatus':
    case 'EndpointDetail':
      updateEndpointStatus(evt);
      break;
    case 'Newchannel':
    case 'Newstate':
    case 'Hangup':
      updateCallStatus(evt);
      break;
  }
  
  // Отправляем обновления клиентам
  io.emit('statusUpdate', {
    endpoints: Array.from(endpointsStatus.entries()),
    calls: Array.from(activeCalls.entries())
  });
}

function updateEndpointStatus(evt) {
  const endpoint = evt.objectname || evt.endpoint;
  if (endpoint && endpoint.includes('-ep')) {
    const sectionName = endpoint.replace('-ep', '');
    endpointsStatus.set(sectionName, {
      endpoint: endpoint,
      status: evt.contactstatus || evt.devicestate || 'Unknown',
      lastUpdate: new Date().toISOString()
    });
  }
}

function updateCallStatus(evt) {
  const channel = evt.channel;
  if (channel && channel.includes('PJSIP/')) {
    const endpoint = channel.split('/')[1].split('-')[0];
    const callId = evt.uniqueid;
    
    if (evt.event === 'Hangup') {
      activeCalls.delete(callId);
    } else {
      activeCalls.set(callId, {
        endpoint: endpoint,
        state: evt.channelstate || evt.state,
        channel: channel,
        callerid: evt.calleridnum || evt.connectedlinenum,
        timestamp: new Date().toISOString()
      });
    }
  }
}

function refreshEndpointsStatus() {
  if (ami && ami.isConnected()) {
    ami.action('PJSIPShowEndpoints', {}, (err, res) => {
      if (err) console.error('Failed to get endpoints:', err);
    });
  }
}

// Настройка мониторинга логов
function setupLogMonitoring() {
  const logFiles = [
    '/var/log/asterisk/full',
    '/var/log/asterisk/messages'
  ];
  
  logFiles.forEach(logFile => {
    if (fs.existsSync(logFile)) {
      try {
        const tail = new Tail(logFile);
        tail.on('line', (data) => {
          // Фильтруем логи только для PJSIP
          if (data.includes('PJSIP') || data.includes('res_pjsip')) {
            io.emit('logUpdate', {
              timestamp: new Date().toISOString(),
              message: data,
              file: path.basename(logFile)
            });
          }
        });
        tail.on('error', (error) => {
          console.log('Log tail error:', error);
        });
      } catch (error) {
        console.log(`Cannot monitor log file ${logFile}:`, error.message);
      }
    }
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
    // Reload Asterisk
    exec('sudo /usr/bin/systemctl reload asterisk', (error, stdout, stderr) => {
      if (error) console.error('Reload error:', stderr);
      res.redirect('/');
    });
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
      exec('sudo /usr/bin/systemctl reload asterisk', (error, stdout, stderr) => {
        if (error) console.error('Reload error:', stderr);
        res.redirect('/');
      });
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
    amiConnected: ami && ami.isConnected()
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
  });
  
  socket.on('unsubscribeLogs', (sectionName) => {
    socket.leave(`logs-${sectionName}`);
  });
});

// Запуск сервера и инициализация мониторинга
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Monitoring interface: http://localhost:${PORT}`);
  
  // Инициализация мониторинга
  setTimeout(() => {
    connectAMI();
    setupLogMonitoring();
  }, 1000);
}); 