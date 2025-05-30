import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { monitoringAPI } from '../services/api';
import { ArrowLeft, Search, Filter, Download, Pause, Play } from 'lucide-react';
import clsx from 'clsx';

const LogsViewer = ({ socket }) => {
  const navigate = useNavigate();
  const { name } = useParams();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  const { subscribeLogs, unsubscribeLogs, onNewLog } = socket;

  // Загрузка начальных логов
  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await monitoringAPI.getLogs(name);
      setLogs(response.data.logs);
    } catch (err) {
      console.error('Ошибка загрузки логов:', err);
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация логов
  useEffect(() => {
    let filtered = logs;

    // Фильтр по тексту
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по уровню
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Фильтр по источнику
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, sourceFilter]);

  // Автопрокрутка
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Подписка на новые логи
  useEffect(() => {
    subscribeLogs(name);

    const unsubscribe = onNewLog((newLog) => {
      if (!isPaused) {
        setLogs(prev => [...prev, newLog]);
      }
    });

    return () => {
      unsubscribeLogs(name);
      if (unsubscribe) unsubscribe();
    };
  }, [name, isPaused]);

  useEffect(() => {
    loadLogs();
  }, [name]);

  // Получение уникальных источников
  const uniqueSources = [...new Set(logs.map(log => log.source).filter(Boolean))];

  // Форматирование времени
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU');
  };

  // Получение цвета для уровня лога
  const getLevelColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'ERROR': return 'text-red-600 bg-red-50';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50';
      case 'INFO': return 'text-blue-600 bg-blue-50';
      case 'DEBUG': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Экспорт логов
  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${formatTime(log.timestamp)}] ${log.level} ${log.source || ''}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_logs_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Логи секции: {name}
            </h2>
            <p className="text-gray-600">
              Просмотр логов в реальном времени
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={clsx(
              'btn flex items-center space-x-2',
              isPaused ? 'btn-success' : 'btn-secondary'
            )}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? 'Возобновить' : 'Пауза'}</span>
          </button>
          
          <button
            onClick={exportLogs}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Экспорт</span>
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Поиск в логах..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Фильтр по уровню */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все уровни</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>

          {/* Фильтр по источнику */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все источники</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>

          {/* Автопрокрутка */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Автопрокрутка</span>
          </label>
        </div>

        {/* Статистика */}
        <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
          <span>Всего логов: {logs.length}</span>
          <span>Отфильтровано: {filteredLogs.length}</span>
          <span className={clsx(
            'flex items-center space-x-1',
            isPaused ? 'text-yellow-600' : 'text-green-600'
          )}>
            <div className={clsx(
              'w-2 h-2 rounded-full',
              isPaused ? 'bg-yellow-500' : 'bg-green-500'
            )} />
            <span>{isPaused ? 'Приостановлено' : 'В реальном времени'}</span>
          </span>
        </div>
      </div>

      {/* Логи */}
      <div className="card p-0">
        <div 
          ref={logsContainerRef}
          className="h-96 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {logs.length === 0 ? 'Логи не найдены' : 'Нет логов, соответствующих фильтрам'}
            </div>
          ) : (
            <div className="p-4 space-y-1">
              {filteredLogs.map((log, index) => (
                <div key={index} className="flex space-x-3 hover:bg-gray-800 px-2 py-1 rounded">
                  <span className="text-gray-400 shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium shrink-0',
                    getLevelColor(log.level)
                  )}>
                    {log.level}
                  </span>
                  {log.source && (
                    <span className="text-blue-400 shrink-0">
                      [{log.source}]
                    </span>
                  )}
                  <span className="text-gray-300 break-all">
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsViewer; 