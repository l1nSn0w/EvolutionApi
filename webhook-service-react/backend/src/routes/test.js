const express = require('express');
const router = express.Router();

// Rota de teste para o Kommo verificar a acessibilidade
router.get('/kommo-test', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Kommo test endpoint is working' });
});

module.exports = router; 