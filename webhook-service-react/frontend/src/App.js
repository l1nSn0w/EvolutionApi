import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import KommoAuth from './pages/KommoAuth';
import Messages from './pages/Messages';
import Dashboard from './pages/Dashboard';
import AdDashboard from './pages/AdDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="navbar-container">
            <div className="navbar-brand">
              Webhook Service
            </div>
            <div className="navbar-links">
              <Link
                to="/"
                className="navbar-link"
              >
                Autenticação
              </Link>
              <Link
                to="/messages"
                className="navbar-link"
              >
                Mensagens
              </Link>
              <Link
                to="/dashboard"
                className="navbar-link"
              >
                Dashboard
              </Link>
              <Link
                to="/ad-dashboard"
                className="navbar-link"
              >
                Dashboard de Anúncios
              </Link>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<KommoAuth />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ad-dashboard" element={<AdDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
