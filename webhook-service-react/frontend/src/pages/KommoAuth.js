import React from 'react';
import KommoOfficialButton from '../components/KommoOfficialButton';
import '../components/KommoOfficialButton.css';

const KommoAuth = () => {
  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1>Integração com Kommo</h1>
      <p>Clique no botão abaixo para conectar sua conta do Kommo</p>
      <KommoOfficialButton />
    </div>
  );
};

export default KommoAuth; 