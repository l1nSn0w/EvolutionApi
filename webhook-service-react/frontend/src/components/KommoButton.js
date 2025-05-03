import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './KommoButton.css';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

const KommoButton = ({ clientId, errorCallback }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [ngrokUrl, setNgrokUrl] = useState('');
  
  useEffect(() => {
    // Obter URL do ngrok do backend
    const fetchNgrokUrl = async () => {
      try {
        if (clientId) {
          setIsLoading(false);
          
          // Obter URL do ngrok configurado no backend
          const response = await axios.get(`${API_URL}/api/kommo/config`);
          if (response.data && response.data.ngrokUrl) {
            setNgrokUrl(response.data.ngrokUrl);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar URL do ngrok:', error);
        setIsLoading(false);
      }
    };
    
    fetchNgrokUrl();
  }, [clientId]);

  const handleButtonClick = () => {
    // Usar a URL do ngrok ou a origem atual como fallback
    const origin = ngrokUrl || window.location.origin;
    
    // Construir URL de autorização no formato correto como no botão oficial da Kommo
    const authUrl = `https://www.kommo.com/br/oauth/?state=webhook-evolution-api-state&mode=popup&origin=${origin}&client_id=${clientId}`;
    
    console.log('Abrindo URL de autorização:', authUrl);
    
    // Dimensões da janela de popup
    const width = 800;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Abrir o popup
    const popupWindow = window.open(
      authUrl,
      'KommoAuthWindow',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    
    // Verificar se o popup foi bloqueado pelo navegador
    if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === 'undefined') {
      alert('Por favor, permita popups para este site para continuar com a autenticação.');
      return;
    }
    
    // Configurar intervalo para verificar quando o popup é fechado
    const checkPopupClosed = setInterval(() => {
      if (popupWindow.closed) {
        clearInterval(checkPopupClosed);
        console.log('Popup fechado, recarregando a página...');
        window.location.reload();
      }
    }, 500);
  };

  if (isLoading) {
    return <div className="kommo-button-loading">Carregando...</div>;
  }

  return (
    <button 
      onClick={handleButtonClick}
      className="kommo-button"
    >
      <span className="kommo-button-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="kommo-button-text">Integrar com Kommo</span>
    </button>
  );
};

export default KommoButton; 