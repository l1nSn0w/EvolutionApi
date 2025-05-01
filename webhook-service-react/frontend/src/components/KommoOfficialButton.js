import React, { useEffect, useState, useRef } from 'react';
import './KommoOfficialButton.css';

const KommoOfficialButton = () => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState(null);
  const buttonContainerRef = useRef(null);

  useEffect(() => {
    console.log('KommoOfficialButton: Iniciando carregamento do script');
    
    // Verificar se o script já existe
    const existingScript = document.querySelector('script.kommo_oauth');
    if (existingScript) {
      console.log('KommoOfficialButton: Script já existe, removendo');
      document.body.removeChild(existingScript);
    }
    
    // Criar o script
    const script = document.createElement('script');
    script.className = 'kommo_oauth';
    script.charset = 'utf-8';
    script.setAttribute('data-client-id', 'cc3d1fc9-71d6-478c-bf9b-ef6fa002080d');
    script.setAttribute('data-title', 'Continuar com Kommo');
    script.setAttribute('data-compact', 'false');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-locale', 'pt');
    script.setAttribute('data-mode', 'popup');
    script.setAttribute('data-origin', window.location.origin);
    
    // Adicionar evento de carregamento
    script.onload = () => {
      console.log('KommoOfficialButton: Script carregado com sucesso');
      setScriptLoaded(true);
      
      // Após o script carregar, mover o botão para o container
      setTimeout(() => {
        const kommoButton = document.querySelector('.kommo-oauth');
        if (kommoButton && buttonContainerRef.current) {
          buttonContainerRef.current.appendChild(kommoButton);
        }
      }, 100);
    };
    
    script.onerror = (err) => {
      console.error('KommoOfficialButton: Erro ao carregar script', err);
      setError('Erro ao carregar o botão da Kommo');
    };
    
    script.src = 'https://www.kommo.com/auth/button.js';
    
    // Adicionar o script ao documento
    document.body.appendChild(script);
    
    // Limpar quando o componente for desmontado
    return () => {
      console.log('KommoOfficialButton: Removendo script');
      const scriptToRemove = document.querySelector('script.kommo_oauth');
      if (scriptToRemove) {
        document.body.removeChild(scriptToRemove);
      }
    };
  }, []);

  return (
    <div className="kommo-button-container">
      {error && <div className="kommo-error">{error}</div>}
      {!scriptLoaded && !error && <div className="kommo-loading">Carregando botão da Kommo...</div>}
      <div ref={buttonContainerRef} id="kommo-button-container"></div>
    </div>
  );
};

export default KommoOfficialButton; 