const express = require('express');
const router = express.Router();
const WhatsappController = require('../controllers/WhatsappController');

// Rota para enviar mensagem de texto para grupo
router.post('/group/message', WhatsappController.sendGroupMessage);

// Rota para enviar imagem para grupo
router.post('/group/image', WhatsappController.sendGroupImage);

module.exports = router; 