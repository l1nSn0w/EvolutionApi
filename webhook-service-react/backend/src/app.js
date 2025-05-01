const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Importar modelos
require('./models/WebhookMessage');
require('./models/KommoToken');
require('./models/LeadTracking');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas básicas
app.get('/', (req, res) => {
  console.log('Teste de hot-reload - Servidor reiniciado!', new Date().toISOString());
  res.json({ message: 'Webhook Service API' });
});

// Rotas do webhook
app.use('/webhook', require('./routes/webhook'));

// Rotas do Kommo
app.use('/kommo', require('./routes/kommo'));

// Rotas da API do Kommo
app.use('/api/kommo', require('./routes/kommoApi'));

// Rotas do dashboard
app.use('/dashboard', require('./routes/dashboard'));

// Rotas do lead tracking
app.use('/api', require('./routes/leadTracking'));

// Rotas do WhatsApp
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

// Rotas de relatórios
app.use('/api/reports', require('./routes/reportRoutes'));

// Rotas de teste
app.use('/test', require('./routes/test'));

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Inicializar banco de dados e servidor
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await sequelize.sync({alter: true});
    console.log('Database synchronized successfully.');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();

module.exports = app; 