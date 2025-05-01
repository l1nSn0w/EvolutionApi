import React from 'react';
import '../styles/LeadHistoryModal.css';

const LeadHistoryModal = ({ visible, onClose, events }) => {
  if (!visible) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Ordenar eventos por data (mais recente primeiro)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.event_time) - new Date(a.event_time)
  );

  // Função para determinar a cor do status com base no nome
  const getStatusColor = (statusName) => {
    if (!statusName) return '#6c757d'; // Cinza para status desconhecido
    
    const statusLower = statusName.toLowerCase();
    
    if (statusLower.includes('ganh') || statusLower.includes('conclu')) {
      return '#28a745'; // Verde para status de sucesso
    } else if (statusLower.includes('perd') || statusLower.includes('cancel')) {
      return '#dc3545'; // Vermelho para status de falha
    } else if (statusLower.includes('aguard') || statusLower.includes('pend')) {
      return '#ffc107'; // Amarelo para status de espera
    } else if (statusLower.includes('em and') || statusLower.includes('process')) {
      return '#17a2b8'; // Azul para status em andamento
    } else {
      return '#6c757d'; // Cinza para outros status
    }
  };

  // Função para obter ícone e texto descritivo para cada tipo de evento
  const getEventInfo = (eventType) => {
    switch (eventType) {
      case 'lead_status_changed':
        return {
          icon: '🔄',
          text: 'Mudança de Status',
          description: 'O status do lead foi alterado'
        };
      case 'message_received':
        return {
          icon: '💬',
          text: 'Mensagem Recebida',
          description: 'Uma nova mensagem foi recebida'
        };
      case 'lead_created':
        return {
          icon: '✨',
          text: 'Lead Criado',
          description: 'Um novo lead foi criado'
        };
      case 'lead_updated':
        return {
          icon: '📝',
          text: 'Lead Atualizado',
          description: 'Informações do lead foram atualizadas'
        };
      case 'lead_deleted':
        return {
          icon: '🗑️',
          text: 'Lead Excluído',
          description: 'O lead foi excluído'
        };
      default:
        return {
          icon: '📌',
          text: eventType,
          description: 'Evento registrado'
        };
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content lead-history-modal">
        <div className="modal-header">
          <h2>Histórico do Lead</h2>
          <button className="button" onClick={onClose}>Fechar</button>
        </div>
        <div className="modal-body">
          {sortedEvents.length > 0 ? (
            <div className="funnel-container">
              <div className="funnel-timeline">
                {sortedEvents.map((event, index) => {
                  const eventInfo = getEventInfo(event.event_type);
                  return (
                    <div key={event.id} className="funnel-step">
                      <div className="funnel-step-content">
                        <div className="funnel-step-header">
                          <div className="funnel-step-date">{formatDate(event.event_time)}</div>
                          <div className="funnel-step-type">
                            <span className="event-icon">{eventInfo.icon}</span>
                            <span className="event-text">{eventInfo.text}</span>
                          </div>
                        </div>
                        
                        <div className="funnel-step-description">
                          {eventInfo.description}
                        </div>
                        
                        <div className="funnel-step-body">
                          <div className="funnel-pipeline">
                            <span className="funnel-label">Pipeline:</span>
                            <span className="funnel-value">{event.current_pipeline?.name || '-'}</span>
                          </div>
                          
                          <div className="funnel-status">
                            <span className="funnel-label">Status:</span>
                            <span 
                              className="funnel-value status-badge" 
                              style={{ backgroundColor: getStatusColor(event.current_status?.name) }}
                            >
                              {event.current_status?.name || '-'}
                            </span>
                          </div>
                          
                          {event.lead_situation && (
                            <div className="funnel-situation">
                              <span className="funnel-label">Situação:</span>
                              <span className="funnel-value">{event.lead_situation}</span>
                            </div>
                          )}

                          {event.price && (
                            <div className="funnel-price">
                              <span className="funnel-label">Valor:</span>
                              <span className="funnel-value">R$ {event.price}</span>
                            </div>
                          )}

                          {event.responsible_user_name && (
                            <div className="funnel-responsible">
                              <span className="funnel-label">Responsável:</span>
                              <span className="funnel-value">{event.responsible_user_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {index < sortedEvents.length - 1 && (
                        <div className="funnel-connector">
                          <div className="funnel-arrow"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="no-history">
              <p>Nenhum histórico encontrado para este lead.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadHistoryModal; 