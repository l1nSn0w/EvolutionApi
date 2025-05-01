import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './KommoIntegrationInfo.css';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

const KommoIntegrationInfo = () => {
  const [integrationInfo, setIntegrationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIntegrationInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/kommo/status`);
        if (response.data && response.data.isAuthenticated) {
          setIntegrationInfo(response.data.tokenInfo);
        }
      } catch (err) {
        console.error('Erro ao buscar informações da integração:', err);
        setError('Erro ao carregar informações da integração');
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrationInfo();
  }, []);

  const handleRevokeToken = async () => {
    if (!integrationInfo?.account_id) return;

    try {
      await axios.get(`${API_URL}/kommo/revoke-token?account_id=${integrationInfo.account_id}`);
      setIntegrationInfo(null);
      window.location.reload();
    } catch (err) {
      console.error('Erro ao revogar token:', err);
      setError('Erro ao remover integração');
    }
  };

  // Função para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Verificar se o token está expirado
  const isTokenExpired = () => {
    if (!integrationInfo?.expires_at) return false;
    return new Date() > new Date(integrationInfo.expires_at);
  };

  if (loading) {
    return (
      <div className="kommo-integration-card">
        <div className="kommo-integration-loading">
          <i className="bi bi-arrow-repeat"></i> Carregando informações...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kommo-integration-card">
        <div className="kommo-integration-error">
          <i className="bi bi-exclamation-circle"></i> {error}
        </div>
      </div>
    );
  }

  if (!integrationInfo) {
    return (
      <div className="kommo-integration-card">
        <div className="kommo-integration-header">
          <i className="bi bi-box-arrow-in-right"></i>
          <h5>Integração com Kommo</h5>
        </div>
        <p className="kommo-integration-description">
          Integre sua conta Kommo para acessar os dados dos seus leads diretamente no dashboard.
        </p>
        <div className="kommo-integration-button">
          <a href="/" className="btn btn-primary">
            <i className="bi bi-box-arrow-in-right"></i> Integrar com Kommo
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="kommo-integration-card">
      <div className="kommo-integration-header">
        <i className="bi bi-box-arrow-in-right"></i>
        <h5>Integração com Kommo</h5>
      </div>
      
      <div className="kommo-integration-success">
        <i className="bi bi-check-circle-fill"></i> Conta Kommo integrada com sucesso!
      </div>
      
      <div className="kommo-integration-info">
        <h6><i className="bi bi-info-circle"></i> Informações da Integração</h6>
        <div className="info-item">
          <strong><i className="bi bi-building"></i> Conta:</strong> {integrationInfo.account_id}
        </div>
        <div className="info-item">
          <strong><i className="bi bi-globe"></i> Domínio:</strong> {integrationInfo.domain}
        </div>
        <div className="info-item">
          <strong><i className="bi bi-clock-history"></i> Expiração:</strong> 
          <span className={isTokenExpired() ? "text-danger" : "text-success"}>
            {formatDate(integrationInfo.expires_at)}
            {isTokenExpired() && <i className="bi bi-exclamation-triangle-fill text-danger ms-1" title="Token expirado"></i>}
          </span>
        </div>
        <div className="info-item">
          <strong><i className="bi bi-calendar-check"></i> Conectado em:</strong> {formatDate(integrationInfo.created_at)}
        </div>
        <div className="info-item">
          <strong><i className="bi bi-arrow-repeat"></i> Última atualização:</strong> {formatDate(integrationInfo.updated_at)}
        </div>
      </div>
      
      <div className="kommo-integration-actions">
        <button 
          onClick={handleRevokeToken}
          className="btn btn-outline-danger"
        >
          <i className="bi bi-trash"></i> Remover Integração
        </button>
      </div>
    </div>
  );
};

export default KommoIntegrationInfo; 