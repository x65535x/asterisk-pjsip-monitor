# Настройка Asterisk Manager Interface (AMI)

Для полноценного мониторинга PJSIP необходимо настроить AMI в Asterisk.

## 1. Настройка manager.conf

Отредактируйте файл `/etc/asterisk/manager.conf`:

```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[admin]
secret = your_ami_password
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
```

## 2. Обновите настройки в app.js

```javascript
const AMI_CONFIG = {
  port: 5038,
  host: 'localhost',
  username: 'admin',
  password: 'your_ami_password', // Замените на ваш пароль
  events: 'on'
};
```

## 3. Настройка логирования

В файле `/etc/asterisk/logger.conf` добавьте:

```ini
[logfiles]
console => notice,warning,error
messages => notice,warning,error
full => notice,warning,error,debug,verbose
```

## 4. Перезапуск Asterisk

```bash
sudo systemctl restart asterisk
```

## 5. Проверка подключения

Проверьте доступность AMI:

```bash
telnet localhost 5038
```

Вы должны увидеть приветствие Asterisk Manager.

## 6. Настройка PJSIP логирования

В файле `/etc/asterisk/pjsip.conf` добавьте в секцию [global]:

```ini
[global]
debug=yes
```

## Безопасность

- Используйте сильный пароль для AMI
- Ограничьте доступ к AMI только локальным подключениям
- Регулярно ротируйте пароли
- Мониторьте подключения к AMI 