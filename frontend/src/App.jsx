import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import SectionEdit from './pages/SectionEdit';
import SectionCreate from './pages/SectionCreate';
import LogsViewer from './pages/LogsViewer';

function App() {
  const socket = useSocket();

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header socket={socket} />
        
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={<Dashboard socket={socket} />} 
            />
            <Route 
              path="/section/new" 
              element={<SectionCreate />} 
            />
            <Route 
              path="/section/:name/edit" 
              element={<SectionEdit />} 
            />
            <Route 
              path="/section/:name/logs" 
              element={<LogsViewer socket={socket} />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 