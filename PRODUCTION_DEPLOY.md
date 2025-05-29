# 🚀 Развертывание на боевом сервере

## Подготовка

### 1. Требования к серверу
- Linux (Ubuntu/CentOS/RHEL)
- Node.js 14+ и npm
- Git
- Asterisk с настроенным PJSIP
- Права sudo/root

### 2. Проверка перед обновлением
```bash
# Проверьте статус Asterisk
sudo systemctl status asterisk

# Проверьте текущее приложение (если есть)
sudo systemctl status asterisk-monitor 2>/dev/null || echo "Сервис не найден"

# Проверьте Node.js
node --version
npm --version
```

## 🛡️ Безопасное обновление

### Шаг 1: Загрузка скрипта развертывания
```bash
# Скачиваем скрипт
wget https://raw.githubusercontent.com/x65535x/asterisk-pjsip-monitor/main/deploy.sh

# Делаем исполняемым
chmod +x deploy.sh
```

### Шаг 2: Создание backup (рекомендуется)
```bash
# Создайте резервную копию перед обновлением
sudo ./deploy.sh --backup-only
```

### Шаг 3: Основное развертывание
```bash
# Запуск полного обновления
sudo ./deploy.sh
```

## 🔧 Настройка после развертывания

### 1. Настройка AMI (обязательно)

Отредактируйте `/etc/asterisk/manager.conf`:
```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[pjsip_monitor]
secret = your_secure_password
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,command,agent,user,config
write = system,call,log,verbose,command,agent,user,config
```

### 2. Обновление конфигурации приложения

Отредактируйте `/opt/asterisk-monitor/app.js`:
```javascript
// Смените пароль веб-интерфейса
const USERS = { admin: 'your_secure_password' };

// Настройте AMI
const AMI_CONFIG = {
  port: 5038,
  host: 'localhost',
  username: 'pjsip_monitor',
  password: 'your_secure_password',
  events: 'on'
};
```

### 3. Настройка логирования Asterisk

В `/etc/asterisk/logger.conf`:
```ini
[logfiles]
console => notice,warning,error
messages => notice,warning,error
full => notice,warning,error,debug,verbose
```

### 4. Перезапуск сервисов
```bash
# Перезапуск Asterisk для применения настроек AMI
sudo systemctl restart asterisk

# Перезапуск монитора
sudo systemctl restart asterisk-monitor
```

## ✅ Проверка работоспособности

### 1. Проверка сервисов
```bash
# Статус Asterisk
sudo systemctl status asterisk

# Статус монитора
sudo systemctl status asterisk-monitor

# Логи монитора
sudo journalctl -u asterisk-monitor -f
```

### 2. Проверка веб-интерфейса
```bash
# Проверка доступности
curl -u admin:your_password http://localhost:8080

# Проверка API мониторинга
curl -u admin:your_password http://localhost:8080/api/status
```

### 3. Проверка AMI подключения
```bash
# В логах должно быть
sudo journalctl -u asterisk-monitor | grep "AMI Connected"
```

## 🆘 Устранение проблем

### AMI не подключается
```bash
# Проверьте настройки AMI
sudo asterisk -rx "manager show users"

# Проверьте порт
sudo netstat -tlnp | grep 5038

# Проверьте логи Asterisk
sudo tail -f /var/log/asterisk/messages
```

### Веб-интерфейс недоступен
```bash
# Проверьте процесс
sudo ps aux | grep "node app.js"

# Проверьте порт
sudo netstat -tlnp | grep 8080

# Проверьте логи
sudo journalctl -u asterisk-monitor -n 50
```

### Нет логов в реальном времени
```bash
# Проверьте права на логи
sudo ls -la /var/log/asterisk/

# Добавьте пользователя в группу
sudo usermod -a -G asterisk asterisk
```

## 🔄 Откат изменений

Если что-то пошло не так:
```bash
# Откат к предыдущей версии
sudo ./deploy.sh --rollback
```

## 📊 Мониторинг в продакшне

### Логи системы
```bash
# Логи приложения
sudo journalctl -u asterisk-monitor -f

# Логи Asterisk
sudo tail -f /var/log/asterisk/full

# Системные ресурсы
top -p $(pgrep -f "node app.js")
```

### Автозапуск
Сервис автоматически настроен для запуска при загрузке системы.

### Обновления
Для получения обновлений просто запустите:
```bash
sudo ./deploy.sh
```

## 🔒 Безопасность

1. **Смените стандартные пароли**
2. **Настройте firewall** для порта 8080
3. **Используйте HTTPS** в продакшне (nginx proxy)
4. **Регулярно обновляйте** зависимости Node.js
5. **Мониторьте логи** на предмет подозрительной активности

## 📱 Доступ к интерфейсу

После успешного развертывания:
- **URL:** http://YOUR_SERVER_IP:8080
- **Логин:** admin
- **Пароль:** (который вы установили)

---

💡 **Совет:** Сохраните этот файл и скрипт deploy.sh для будущих обновлений! 