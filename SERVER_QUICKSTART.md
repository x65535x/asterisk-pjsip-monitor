# ⚡ Быстрое развертывание на сервере

## 🚀 Одной командой (для нового сервера)

```bash
# Скачиваем и запускаем скрипт развертывания
curl -fsSL https://raw.githubusercontent.com/x65535x/asterisk-pjsip-monitor/main/deploy.sh | sudo bash
```

## 🔧 Для существующего сервера с `/opt/asterisk-monitor/`

### 1. Создание backup
```bash
wget https://raw.githubusercontent.com/x65535x/asterisk-pjsip-monitor/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh --backup-only
```

### 2. Развертывание
```bash
sudo ./deploy.sh
```

### 3. При проблемах - откат
```bash
sudo ./deploy.sh --rollback
```

## ⚠️ После развертывания обязательно:

1. **Настройте AMI в `/etc/asterisk/manager.conf`:**
```ini
[pjsip_monitor]
secret = your_secure_password
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,command,agent,user,config
write = system,call,log,verbose,command,agent,user,config
```

2. **Обновите пароли в `/opt/asterisk-monitor/app.js`:**
```javascript
const USERS = { admin: 'your_secure_password' };
const AMI_CONFIG = {
  username: 'pjsip_monitor',
  password: 'your_secure_password'
};
```

3. **Перезапустите сервисы:**
```bash
sudo systemctl restart asterisk
sudo systemctl restart asterisk-monitor
```

## ✅ Проверка

```bash
# Статус сервисов
sudo systemctl status asterisk-monitor

# Веб-интерфейс
curl -u admin:your_password http://localhost:8080

# Логи
sudo journalctl -u asterisk-monitor -f
```

## 🌐 Доступ

- **URL:** http://YOUR_SERVER_IP:8080
- **Логин:** admin
- **Пароль:** (ваш пароль)

---

📖 **Подробная документация:** [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) 