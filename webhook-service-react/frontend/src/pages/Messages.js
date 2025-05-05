import React, { useState, useEffect } from 'react';
import axios from 'axios';
import KommoIntegrationInfo from '../components/KommoIntegrationInfo';
import LeadHistoryModal from '../components/LeadHistoryModal';
import { getLeadTracking, createManualStageTracking } from '../services/leadTrackingService';
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
  const [trackingStatus, setTrackingStatus] = useState({
    messageId: null,
    loading: false,
    success: false,
    error: null
  });

  const [stageTrackingStatus, setStageTrackingStatus] = useState({
    messageId: null,
    loading: false,
    success: false,
    error: null
  });

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

  const handleCreateTracking = async (messageId) => {
    try {
      setTrackingStatus({
        messageId,
        loading: true,
        success: false,
        error: null
      });

      // Chamada à API para criar o rastreamento manualmente
      const response = await axios.post(`${API_URL}/api/create-manual`, {
        message_id: messageId
      });

      if (response.data.status === 'success') {
        setTrackingStatus({
          messageId,
          loading: false,
          success: true,
          error: null
        });

        // Atualizar a mensagem na lista local para mostrar que agora tem rastreamento
        setMessages(prev => 
          prev.map(message => 
            message.id === messageId 
              ? { 
                  ...message, 
                  has_tracking: true,
                  tracking_id: response.data.tracking?.id
                } 
              : message
          )
        );
        
        // Limpar o status após alguns segundos
        setTimeout(() => {
          setTrackingStatus({
            messageId: null,
            loading: false,
            success: false,
            error: null
          });
        }, 3000);
      }
    } catch (error) {
      console.error('Erro ao criar rastreamento:', error);
      
      // Extrair mensagem de erro da resposta, se existir
      const errorMessage = error.response?.data?.message || 'Erro ao criar rastreamento';
      
      setTrackingStatus({
        messageId,
        loading: false,
        success: false,
        error: errorMessage
      });
      
      // Limpar o erro após alguns segundos
      setTimeout(() => {
        setTrackingStatus({
          messageId: null,
          loading: false,
          success: false,
          error: null
        });
      }, 5000);
    }
  };

  const handleCreateStageTracking = async (messageId, leadId, phone) => {
    try {
      setStageTrackingStatus({
        messageId,
        loading: true,
        success: false,
        error: null
      });

      // Chamada à API para criar o rastreamento de estágio manualmente
      // Usamos o telefone como principal meio de identificação quando não temos o leadId
      const response = await createManualStageTracking(
        leadId || null, 
        phone, 
        !phone ? messageId : null // Só usamos o messageId se não tivermos o telefone
      );

      if (response.status === 'success') {
        setStageTrackingStatus({
          messageId,
          loading: false,
          success: true,
          error: null
        });

        // Atualizar a mensagem na lista local para mostrar que agora tem rastreamento de estágio
        setMessages(prev => 
          prev.map(message => 
            message.id === messageId 
              ? { 
                  ...message, 
                  has_stage_tracking: true
                } 
              : message
          )
        );
        
        // Limpar o status após alguns segundos
        setTimeout(() => {
          setStageTrackingStatus({
            messageId: null,
            loading: false,
            success: false,
            error: null
          });
        }, 3000);
      }
    } catch (error) {
      console.error('Erro ao criar rastreamento de estágio:', error);
      
      // Extrair mensagem de erro da resposta, se existir
      const errorMessage = error.response?.data?.message || 'Erro ao criar rastreamento de estágio';
      
      setStageTrackingStatus({
        messageId,
        loading: false,
        success: false,
        error: errorMessage
      });
      
      // Limpar o erro após alguns segundos
      setTimeout(() => {
        setStageTrackingStatus({
          messageId: null,
          loading: false,
          success: false,
          error: null
        });
      }, 5000);
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
                  <th>Rastreamento</th>
                  <th>Status Kommo</th>
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
                      <span className={`status ${
                        message.has_tracking 
                          ? 'status-success'
                          : 'status-danger'
                      }`}>
                        {message.has_tracking ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <span className={`status ${
                        message.has_stage_tracking 
                          ? 'status-success'
                          : 'status-danger'
                      }`}>
                        {message.has_stage_tracking ? 'Sim' : 'Não'}
                      </span>
                    </td>
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
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          className="button button-primary"
                          onClick={() => window.open(message.url, '_blank')}
                          style={{ padding: '0.25rem 0.5rem' }}
                          disabled={!message.url}
                        >
                          Ver Anúncio
                        </button>
                        
                        {message.has_tracking ? (
                          <button 
                            className="button button-secondary"
                            onClick={() => handleShowHistory(message.lead_id, message.telefone)}
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            Histórico
                          </button>
                        ) : (
                          <button 
                            className="button button-warning"
                            onClick={() => handleCreateTracking(message.id)}
                            disabled={trackingStatus.loading && trackingStatus.messageId === message.id}
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            {trackingStatus.loading && trackingStatus.messageId === message.id ? (
                              <span>Processando...</span>
                            ) : trackingStatus.success && trackingStatus.messageId === message.id ? (
                              <span>✓ Criado!</span>
                            ) : (
                              <span>Criar Rastreamento</span>
                            )}
                          </button>
                        )}
                        
                        {/* Botão para criar rastreamento de estágio - Aparece para qualquer mensagem que não tenha rastreamento de estágio */}
                        {!message.has_stage_tracking && (
                          <button 
                            className="button button-warning"
                            onClick={() => handleCreateStageTracking(message.id, message.lead_id, message.telefone)}
                            disabled={stageTrackingStatus.loading && stageTrackingStatus.messageId === message.id}
                            style={{ padding: '0.25rem 0.5rem', marginLeft: '0.5rem' }}
                          >
                            {stageTrackingStatus.loading && stageTrackingStatus.messageId === message.id ? (
                              <span>Processando...</span>
                            ) : stageTrackingStatus.success && stageTrackingStatus.messageId === message.id ? (
                              <span>✓ Criado!</span>
                            ) : (
                              <span>Rastrear Status</span>
                            )}
                          </button>
                        )}
                        
                        {trackingStatus.error && trackingStatus.messageId === message.id && (
                          <div className="error-message" style={{ color: 'red', fontSize: '0.8rem' }}>
                            {trackingStatus.error}
                          </div>
                        )}
                        
                        {stageTrackingStatus.error && stageTrackingStatus.messageId === message.id && (
                          <div className="error-message" style={{ color: 'red', fontSize: '0.8rem' }}>
                            {stageTrackingStatus.error}
                          </div>
                        )}
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