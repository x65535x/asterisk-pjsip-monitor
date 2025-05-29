#!/bin/bash

# Скрипт безопасного обновления Asterisk PJSIP Monitor
# Использование: ./deploy.sh [--backup-only] [--rollback]

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Настройки
APP_DIR="/opt/asterisk-monitor"
BACKUP_DIR="/opt/asterisk-monitor-backup-$(date +%Y%m%d_%H%M%S)"
SERVICE_NAME="asterisk-monitor"  # Если есть systemd сервис
GIT_REPO="https://github.com/x65535x/asterisk-pjsip-monitor.git"

echo -e "${GREEN}🚀 Asterisk PJSIP Monitor - Безопасное обновление${NC}"
echo "=================================================="

# Функция логирования
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

# Проверка прав
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен запускаться с правами root"
   exit 1
fi

# Обработка аргументов
if [[ "$1" == "--rollback" ]]; then
    log "🔄 Режим отката изменений"
    
    if [[ ! -d "$APP_DIR.backup" ]]; then
        error "Backup не найден: $APP_DIR.backup"
        exit 1
    fi
    
    log "Остановка текущего сервиса..."
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    pkill -f "node app.js" 2>/dev/null || true
    
    log "Восстановление из backup..."
    rm -rf "$APP_DIR"
    mv "$APP_DIR.backup" "$APP_DIR"
    
    log "Запуск восстановленного сервиса..."
    cd "$APP_DIR"
    systemctl start $SERVICE_NAME 2>/dev/null || {
        warn "Systemd сервис не найден, запуск вручную..."
        nohup node app.js > /var/log/asterisk-monitor.log 2>&1 &
    }
    
    log "✅ Откат успешно выполнен"
    exit 0
fi

if [[ "$1" == "--backup-only" ]]; then
    log "💾 Режим только создания backup"
    
    if [[ -d "$APP_DIR" ]]; then
        log "Создание backup: $BACKUP_DIR"
        cp -r "$APP_DIR" "$BACKUP_DIR"
        log "✅ Backup создан: $BACKUP_DIR"
    else
        warn "Приложение не найдено в $APP_DIR"
    fi
    exit 0
fi

# Основной процесс обновления
log "📋 Проверка состояния системы..."

# Проверка зависимостей
command -v node >/dev/null 2>&1 || { error "Node.js не установлен"; exit 1; }
command -v npm >/dev/null 2>&1 || { error "npm не установлен"; exit 1; }
command -v git >/dev/null 2>&1 || { error "git не установлен"; exit 1; }

log "✅ Все зависимости установлены"

# Создание backup существующего приложения
if [[ -d "$APP_DIR" ]]; then
    log "💾 Создание backup существующего приложения..."
    cp -r "$APP_DIR" "$APP_DIR.backup"
    log "✅ Backup создан: $APP_DIR.backup"
else
    warn "Приложение не найдено в $APP_DIR, будет создано новое"
    mkdir -p "$APP_DIR"
fi

# Остановка текущего сервиса
log "⏹️  Остановка текущего сервиса..."
systemctl stop $SERVICE_NAME 2>/dev/null || {
    warn "Systemd сервис не найден, останавливаем процессы..."
    pkill -f "node app.js" 2>/dev/null || true
}

# Клонирование/обновление репозитория
cd /tmp
log "📥 Загрузка обновленного кода..."

if [[ -d "asterisk-pjsip-monitor-deploy" ]]; then
    rm -rf asterisk-pjsip-monitor-deploy
fi

git clone "$GIT_REPO" asterisk-pjsip-monitor-deploy
cd asterisk-pjsip-monitor-deploy

# Сохранение важных файлов конфигурации
log "💾 Сохранение конфигурации..."
CONFIG_FILES=""

if [[ -f "$APP_DIR/app.js" ]]; then
    # Извлекаем пароли и настройки из старого app.js
    OLD_WEB_PASS=$(grep -o "admin.*:.*'.*'" "$APP_DIR/app.js" 2>/dev/null | head -1 || echo "")
    OLD_AMI_CONFIG=$(grep -A5 "AMI_CONFIG.*=" "$APP_DIR/app.js" 2>/dev/null || echo "")
    
    if [[ -n "$OLD_WEB_PASS" ]]; then
        log "✅ Найден старый веб-пароль, будет сохранен"
        CONFIG_FILES+="web_password "
    fi
    
    if [[ -n "$OLD_AMI_CONFIG" ]]; then
        log "✅ Найдена старая конфигурация AMI, будет сохранена"
        CONFIG_FILES+="ami_config "
    fi
fi

# Установка зависимостей
log "📦 Установка зависимостей..."
npm install --production

# Копирование в целевую директорию
log "📋 Развертывание обновлений..."
rsync -av --exclude='.git' --exclude='node_modules' /tmp/asterisk-pjsip-monitor-deploy/ "$APP_DIR/"

# Установка зависимостей в целевой директории
cd "$APP_DIR"
npm install --production

# Восстановление конфигурации
if [[ -n "$CONFIG_FILES" ]]; then
    log "🔧 Восстановление конфигурации..."
    
    if [[ "$CONFIG_FILES" == *"web_password"* ]] && [[ -n "$OLD_WEB_PASS" ]]; then
        log "Восстановление веб-пароля..."
        # Заменяем строку с паролем в новом файле
        sed -i.bak "s/const USERS = { admin: 'secret123' };/$OLD_WEB_PASS;/" app.js
    fi
    
    # Для AMI конфигурации можно создать отдельный конфиг файл
    if [[ "$CONFIG_FILES" == *"ami_config"* ]]; then
        warn "⚠️  Требуется ручная настройка AMI конфигурации"
        warn "Проверьте файл app.js и обновите AMI_CONFIG"
    fi
fi

# Настройка прав
log "🔐 Настройка прав доступа..."
chown -R asterisk:asterisk "$APP_DIR" 2>/dev/null || {
    warn "Пользователь asterisk не найден, используем root"
    chown -R root:root "$APP_DIR"
}
chmod +x "$APP_DIR/app.js"

# Создание systemd сервиса если не существует
if [[ ! -f "/etc/systemd/system/$SERVICE_NAME.service" ]]; then
    log "📋 Создание systemd сервиса..."
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Asterisk PJSIP Monitor
After=network.target asterisk.service

[Service]
Type=simple
User=asterisk
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    log "✅ Systemd сервис создан и включен"
fi

# Запуск сервиса
log "🚀 Запуск обновленного сервиса..."
systemctl start $SERVICE_NAME

# Проверка статуса
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    log "✅ Сервис успешно запущен"
    log "📊 Статус: $(systemctl is-active $SERVICE_NAME)"
    
    # Проверка веб-интерфейса
    if command -v curl >/dev/null 2>&1; then
        log "🌐 Проверка веб-интерфейса..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "401\|200"; then
            log "✅ Веб-интерфейс отвечает"
        else
            warn "⚠️  Веб-интерфейс может быть недоступен"
        fi
    fi
    
    # Удаление временных файлов
    log "🧹 Очистка временных файлов..."
    rm -rf /tmp/asterisk-pjsip-monitor-deploy
    
    log "✅ Обновление успешно завершено!"
    log "🌐 Веб-интерфейс: http://YOUR_SERVER:8080"
    log "📋 Логи: journalctl -u $SERVICE_NAME -f"
    log "🔄 Для отката: $0 --rollback"
    
else
    error "❌ Не удалось запустить сервис"
    error "Проверьте логи: journalctl -u $SERVICE_NAME"
    error "Для отката выполните: $0 --rollback"
    exit 1
fi 