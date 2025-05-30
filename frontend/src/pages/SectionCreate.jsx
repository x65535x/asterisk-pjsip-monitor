import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sectionsAPI } from '../services/api';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, Save } from 'lucide-react';

const SectionCreate = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [content, setContent] = useState(`[endpoint_name]
type = endpoint
context = internal
disallow = all
allow = ulaw,alaw
auth = endpoint_name
aors = endpoint_name

[endpoint_name]
type = auth
auth_type = userpass
password = secret123
username = endpoint_name

[endpoint_name]
type = aor
max_contacts = 1`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите имя секции');
      return;
    }

    if (!content.trim()) {
      setError('Введите содержимое секции');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await sectionsAPI.create({
        name: name.trim(),
        content: content.trim()
      });
      
      navigate('/');
    } catch (err) {
      setError('Ошибка создания секции: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    
    // Автоматически заменяем placeholder в содержимом
    if (newName.trim()) {
      setContent(prev => 
        prev.replace(/endpoint_name/g, newName.trim())
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
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
            Создание новой секции
          </h2>
          <p className="text-gray-600">
            Создайте новую секцию конфигурации PJSIP
          </p>
        </div>
      </div>

      {/* Форма */}
      <div className="card space-y-6">
        {/* Имя секции */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Имя секции
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={handleNameChange}
            placeholder="Например: office_phone_101"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Имя будет использовано для идентификации секции
          </p>
        </div>

        {/* Содержимое секции */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Содержимое секции
          </label>
          <div className="border border-gray-300 rounded-md overflow-hidden">
            <CodeMirror
              value={content}
              onChange={(value) => setContent(value)}
              theme={oneDark}
              height="400px"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightSelectionMatches: false,
              }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Конфигурация в формате Asterisk PJSIP
          </p>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex space-x-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-success flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Сохранение...' : 'Создать секцию'}</span>
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Отмена
          </button>
        </div>
      </div>

      {/* Подсказки */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          💡 Подсказки по созданию секций:
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Используйте уникальные имена для каждой секции</li>
          <li>• Имя секции автоматически заменит placeholder в шаблоне</li>
          <li>• Убедитесь, что все обязательные параметры заполнены</li>
          <li>• Проверьте синтаксис конфигурации перед сохранением</li>
        </ul>
      </div>
    </div>
  );
};

export default SectionCreate; 