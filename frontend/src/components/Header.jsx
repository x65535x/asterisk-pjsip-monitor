import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Wifi, WifiOff, Plus } from 'lucide-react';

const Header = ({ socket }) => {
  const { isConnected, amiConnected } = socket;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo и название */}
          <Link to="/" className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Asterisk PJSIP Monitor
              </h1>
              <p className="text-sm text-gray-500">
                Мониторинг и управление конфигурацией
              </p>
            </div>
          </Link>

          {/* Статус подключений */}
          <div className="flex items-center space-x-6">
            {/* WebSocket статус */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                isConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                WebSocket
              </span>
            </div>

            {/* AMI статус */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                amiConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-sm font-medium ${
                amiConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                AMI {amiConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Кнопка создания новой секции */}
            <Link 
              to="/section/new"
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Новая секция</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 