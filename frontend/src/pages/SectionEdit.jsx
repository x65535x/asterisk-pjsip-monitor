import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sectionsAPI } from '../services/api';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, Save } from 'lucide-react';

const SectionEdit = () => {
  const navigate = useNavigate();
  const { name } = useParams();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка секции
  const loadSection = async () => {
    try {
      setLoading(true);
      const response = await sectionsAPI.getById(name);
      setContent(response.data.section.content);
      setError(null);
    } catch (err) {
      setError('Ошибка загрузки секции: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Сохранение изменений
  const handleSave = async () => {
    if (!content.trim()) {
      setError('Содержимое секции не может быть пустым');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await sectionsAPI.update(name, {
        content: content.trim()
      });
      
      navigate('/');
    } catch (err) {
      setError('Ошибка сохранения: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSection();
  }, [name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
            Редактирование секции: {name}
          </h2>
          <p className="text-gray-600">
            Измените конфигурацию секции PJSIP
          </p>
        </div>
      </div>

      {/* Редактор */}
      <div className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Содержимое секции
          </label>
          <div className="border border-gray-300 rounded-md overflow-hidden">
            <CodeMirror
              value={content}
              onChange={(value) => setContent(value)}
              theme={oneDark}
              height="500px"
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
            <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Отмена
          </button>
        </div>
      </div>

      {/* Предупреждение */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">
          ⚠️ Внимание:
        </h3>
        <p className="text-sm text-yellow-700">
          Изменения будут применены к конфигурации Asterisk и вызовут перезагрузку модуля PJSIP.
          Убедитесь, что синтаксис конфигурации корректен.
        </p>
      </div>
    </div>
  );
};

export default SectionEdit; 