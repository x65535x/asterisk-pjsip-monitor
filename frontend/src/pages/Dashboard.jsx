import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sectionsAPI, monitoringAPI } from '../services/api';
import { Edit, FileText, RefreshCw, Phone, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const Dashboard = ({ socket }) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const { endpointStatuses } = socket;

  // Загрузка секций
  const loadSections = async () => {
    try {
      setLoading(true);
      const response = await sectionsAPI.getAll();
      setSections(response.data.sections);
      setError(null);
    } catch (err) {
      setError('Ошибка загрузки секций: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Обновление статуса
  const refreshStatus = async () => {
    try {
      setRefreshing(true);
      await monitoringAPI.getStatus();
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Удаление секции
  const deleteSection = async (name) => {
    if (!confirm(`Удалить секцию "${name}"?`)) return;
    
    try {
      await sectionsAPI.delete(name);
      await loadSections();
    } catch (err) {
      alert('Ошибка удаления: ' + err.message);
    }
  };

  useEffect(() => {
    loadSections();
  }, []);

  // Получение статуса для секции
  const getSectionStatus = (sectionName) => {
    // Ищем endpoint по имени секции или извлекаем из содержимого
    const status = endpointStatuses[sectionName] || 
                  endpointStatuses[extractEndpointFromSection(sectionName)];
    
    return status || { status: 'unknown', calls: 0 };
  };

  // Извлечение endpoint из имени секции (простая эвристика)
  const extractEndpointFromSection = (sectionName) => {
    // Ищем числа в имени секции (например, office_phone_101 -> 101)
    const match = sectionName.match(/\d+/);
    return match ? match[0] : sectionName;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={loadSections}
          className="mt-2 btn btn-primary"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка обновления */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            PJSIP Секции
          </h2>
          <p className="text-gray-600">
            Найдено секций: {sections.length}
          </p>
        </div>
        
        <button
          onClick={refreshStatus}
          disabled={refreshing}
          className={clsx(
            'btn btn-secondary flex items-center space-x-2',
            refreshing && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          <span>Обновить статус</span>
        </button>
      </div>

      {/* Сетка карточек секций */}
      {sections.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Секции не найдены
          </h3>
          <p className="text-gray-600 mb-4">
            Создайте первую секцию для начала работы
          </p>
          <Link to="/section/new" className="btn btn-primary">
            Создать секцию
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const sectionStatus = getSectionStatus(section.name);
            const hasCalls = sectionStatus.calls > 0;
            
            return (
              <div
                key={section.name}
                className={clsx(
                  'card animate-fade-in',
                  hasCalls && 'card-calling'
                )}
              >
                {/* Заголовок карточки */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {section.name}
                    </h3>
                    
                    {/* Статус индикатор */}
                    <div className="flex items-center space-x-2">
                      <div className={clsx(
                        'status-indicator',
                        `status-${sectionStatus.status}`
                      )} />
                      <span className="text-sm text-gray-600 capitalize">
                        {sectionStatus.status === 'online' && 'В сети'}
                        {sectionStatus.status === 'offline' && 'Не в сети'}
                        {sectionStatus.status === 'unknown' && 'Неизвестно'}
                      </span>
                      
                      {/* Индикатор звонков */}
                      {hasCalls && (
                        <div className="flex items-center space-x-1 text-yellow-600">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {sectionStatus.calls} звонок{sectionStatus.calls > 1 ? 'а' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Кнопка удаления */}
                  <button
                    onClick={() => deleteSection(section.name)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Удалить секцию"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Превью содержимого */}
                <div className="mb-4">
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded border overflow-hidden">
                    {section.content.split('\n').slice(0, 5).join('\n')}
                    {section.content.split('\n').length > 5 && '\n...'}
                  </pre>
                </div>

                {/* Кнопки действий */}
                <div className="flex space-x-2">
                  <Link
                    to={`/section/${section.name}/edit`}
                    className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Редактировать</span>
                  </Link>
                  
                  <Link
                    to={`/section/${section.name}/logs`}
                    className="btn btn-secondary flex-1 flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Логи</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 