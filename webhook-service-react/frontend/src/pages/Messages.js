import React, { useState, useEffect } from 'react';
import axios from 'axios';
import KommoIntegrationInfo from '../components/KommoIntegrationInfo';
import LeadHistoryModal from '../components/LeadHistoryModal';
import { getLeadTracking } from '../services/leadTrackingService';
import '../styles/Dashboard.css';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [historyVisible, setHistoryVisible] = useState(false);
  const [leadHistory, setLeadHistory] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, [dateRange]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/webhook/messages`, {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      });
      setMessages(response.data);
      setError('');
    } catch (error) {
      setError('Erro ao carregar mensagens');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleShowHistory = async (leadId, phone) => {
    try {
      setSelectedLeadId(leadId);
      console.log('Buscando histórico para leadId:', leadId, 'e telefone:', phone);
      const response = await getLeadTracking(leadId, phone);
      setLeadHistory(response.events);
      setHistoryVisible(true);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setError('Erro ao carregar histórico do lead');
    }
  };

  return (
    <div style={{ margin: '2rem auto', maxWidth: '1200px' }}>
      {/* Seção de Integrações */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>
          Integrações
        </h2>
        <KommoIntegrationInfo />
      </div>

      {/* Card de Mensagens */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Mensagens Recebidas
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
              className="form-input"
              style={{ width: 'auto' }}
            />
            <input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
              className="form-input"
              style={{ width: 'auto' }}
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data/Hora</th>
                  <th>Telefone</th>
                  <th>Nome</th>
                  <th>Dispositivo</th>
                  {/* Coluna de encaminhada removida, mas mantida como comentário para referência futura */}
                  {/* <th>Encaminhada</th> */}
                  <th style={{ width: '25%' }}>Anúncio</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {message.id}
                      </div>
                    </td>
                    <td>
                      {new Date(message.date_time).toLocaleString()}
                    </td>
                    <td>
                      {message.telefone}
                    </td>
                    <td>
                      {message.nome}
                    </td>
                    <td>
                      <span className={`status ${
                        message.dispositivo === 'android' 
                          ? 'status-success'
                          : 'status-info'
                      }`}>
                        {message.dispositivo}
                      </span>
                    </td>
                    {/* Coluna de encaminhada removida, mas mantida como comentário para referência futura */}
                    {/* <td>
                      <span className={`status ${
                        message.encaminhado_make 
                          ? 'status-success'
                          : 'status-warning'
                      }`}>
                        {message.encaminhado_make ? 'Sim' : 'Não'}
                      </span>
                    </td> */}
                    <td>
                      <div className="ad-info">
                        {message.campaign_name && (
                          <div className="ad-campaign">
                            <span className="ad-label">Campanha:</span>
                            <span className="ad-value">{message.campaign_name}</span>
                          </div>
                        )}
                        {message.adset_name && (
                          <div className="ad-adset">
                            <span className="ad-label">Conjunto:</span>
                            <span className="ad-value">{message.adset_name}</span>
                          </div>
                        )}
                        {message.ad_name && (
                          <div className="ad-name">
                            <span className="ad-label">Anúncio:</span>
                            <span className="ad-value">{message.ad_name}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="button button-primary"
                          onClick={() => window.open(message.url, '_blank')}
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          Ver Anúncio
                        </button>
                        <button 
                          className="button button-secondary"
                          onClick={() => handleShowHistory(message.lead_id, message.telefone)}
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          Histórico
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LeadHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        events={leadHistory}
      />
    </div>
  );
};

export default Messages; 