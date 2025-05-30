import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [amiConnected, setAmiConnected] = useState(false);
  const [endpointStatuses, setEndpointStatuses] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    // Создаем подключение
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    // Обработчики событий подключения
    socket.on('connect', () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    // Обработчики событий мониторинга
    socket.on('ami_status', (data) => {
      setAmiConnected(data.connected);
    });

    socket.on('endpoint_status', (data) => {
      setEndpointStatuses(prev => ({
        ...prev,
        [data.endpoint]: {
          status: data.status,
          calls: data.calls,
          lastUpdate: new Date()
        }
      }));
    });

    // Cleanup при размонтировании
    return () => {
      socket.disconnect();
    };
  }, []);

  // Функции для управления подписками
  const subscribeLogs = (section) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_logs', section);
    }
  };

  const unsubscribeLogs = (section) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_logs', section);
    }
  };

  const onNewLog = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('new_log', callback);
      return () => socketRef.current.off('new_log', callback);
    }
  };

  return {
    isConnected,
    amiConnected,
    endpointStatuses,
    subscribeLogs,
    unsubscribeLogs,
    onNewLog,
    socket: socketRef.current
  };
}; 