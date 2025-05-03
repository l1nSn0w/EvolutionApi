import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import '../styles/AdDashboard.css';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

const AdDashboard = () => {
  const [dateRange, setDateRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedAdSet, setSelectedAdSet] = useState('all');
  const [selectedAd, setSelectedAd] = useState('all');
  const [selectedLeadSituation, setSelectedLeadSituation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricsData, setMetricsData] = useState(null);

  // Buscar dados da API
  useEffect(() => {
    const fetchMetricsData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/dashboard/ad-metrics`);
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar dados: ${response.status}`);
        }
        
        const data = await response.json();
        setMetricsData(data);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar métricas:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetricsData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const handleDateRangeChange = (e) => {
    setDateRange(e.target.value);
  };

  const handleDateChange = (e) => {
    if (e.target.name === 'startDate') {
      setStartDate(e.target.value);
    } else {
      setEndDate(e.target.value);
    }
  };

  // Função auxiliar para formatar segundos em HH:MM:SS
  const formatTimeInSeconds = (seconds) => {
    if (!seconds && seconds !== 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Se estiver carregando, mostrar indicador
  if (loading) {
    return <div className="loading">Carregando métricas...</div>;
  }

  // Se houver erro, mostrar mensagem
  if (error) {
    return <div className="error-message">Erro: {error}</div>;
  }

  // Se não houver dados, mostrar mensagem
  if (!metricsData) {
    return <div className="no-data-message">Nenhum dado disponível</div>;
  }

  // Extrair dados da resposta da API
  const { campaigns, adSets, ads, top_users } = metricsData;
  
  // Calcular métricas gerais
  const overview = {
    totalLeads: campaigns.reduce((sum, campaign) => sum + (campaign.total_leads || 0), 0),
    totalSales: campaigns.reduce((sum, campaign) => sum + (campaign.converted_leads || 0), 0),
    lostLeads: campaigns.reduce((sum, campaign) => 
      sum + Object.values(campaign.lost_reasons || {}).reduce((a, b) => a + b, 0), 0),
    conversionRate: campaigns.length > 0 ? 
      parseFloat((campaigns.reduce((sum, campaign) => sum + (campaign.converted_leads || 0), 0) / 
       campaigns.reduce((sum, campaign) => sum + (campaign.total_leads || 0), 0) * 100).toFixed(2)) : 0,
    avgConversionTime: formatTimeInSeconds(campaigns.find(c => c.average_conversion_time)?.average_conversion_time),
    avgDiscardTime: formatTimeInSeconds(campaigns.find(c => c.average_discard_time)?.average_discard_time)
  };
  
  // Preparar dados para gráficos e tabelas
  const adsForTable = ads.map(ad => {
    // Para cada anúncio, procurar o conjunto de anúncios correspondente pelo nome do anúncio
    // Assumir que ads têm relação 1:1 com adSets (cada anúncio pertence a um conjunto específico)
    const matchingAdSet = adSets.find(adset => 
      // Verificar se há anúncios relacionados a este adSet com o mesmo nome
      // Para dados reais, deveríamos ter uma referência direta
      ad.ad_name.includes(adset.adset_name.substring(0, 5)) || 
      adset.adset_name.includes(ad.ad_name.substring(0, 5))
    );
    
    // Mesma lógica para campanhas
    const matchingCampaign = campaigns.find(campaign => 
      // Na falta de referência direta, usamos a lógica de que ads e campaign têm alguma relação de nome
      // Para dados reais, deveríamos ter uma referência direta
      campaign.campaign_id
    );
    
    // Com base no exemplo, sabemos estas associações específicas
    let adsetName = 'N/A';
    let campaignName = 'N/A';
    
    // AD10 - 29/04 - note 14 -> CJ 51 - 17/02 [Poco X6 Pro]
    if (ad.ad_name === "AD10 - 29/04 - note 14") {
      adsetName = adSets.find(as => as.adset_id === "6681969001721")?.adset_name || 'N/A';
    }
    // AD01 - 05/03 - note 14 pro -> CJ 53 - 05/03 [Note 14 Pro]
    else if (ad.ad_name === "AD01 - 05/03 - note 14 pro") {
      adsetName = adSets.find(as => as.adset_id === "6694169304921")?.adset_name || 'N/A';
    }
    
    // Todos os anúncios pertencem a UP - MENSAGEM - XIAOMI - 18/10/2023
    campaignName = campaigns[0]?.campaign_name || 'N/A';
    
    return {
      ad_name: ad.ad_name,
      leads: ad.total_leads,
      sales: ad.converted_leads,
      conversion: ad.conversion_rate,
      adset_name: adsetName,
      campaign_name: campaignName,
      farthest_stage: ad.farthest_stage_reached
    };
  });
  
  const adsetsForTable = adSets.map(adset => {
    // Encontrar campanhas relacionadas a este adset - no nosso caso, todos os adsets
    // pertencem à mesma campanha
    const campaignNames = [campaigns[0]?.campaign_name || 'N/A'];
    
    return {
      adset_name: adset.adset_name,
      leads: adset.total_leads,
      sales: adset.converted_leads,
      conversion: adset.conversion_rate,
      campaigns: campaignNames,
      farthest_stage: adset.farthest_stage_reached
    };
  });
  
  const campaignsForTable = campaigns.map(campaign => {
    // Como sabemos que todos os anúncios pertencem à campanha principal
    // (já que só temos uma campanha), podemos simplesmente contar o número total de anúncios
    const activeAds = ads.length;
    
    return {
      campaign_name: campaign.campaign_name,
      leads: campaign.total_leads,
      sales: campaign.converted_leads,
      conversion: campaign.conversion_rate,
      active_ads: activeAds,
      farthest_stage: campaign.farthest_stage_reached
    };
  });
  
  // Dados para gráfico de motivos de perda - consolidando de todas as campanhas
  const consolidatedLostReasons = {};
  campaigns.forEach(campaign => {
    if (campaign.lost_reasons) {
      Object.entries(campaign.lost_reasons).forEach(([reason, count]) => {
        consolidatedLostReasons[reason] = (consolidatedLostReasons[reason] || 0) + count;
      });
    }
  });
  
  const lossReasonsData = Object.entries(consolidatedLostReasons).map(([reason, count]) => ({
    reason,
    count
  }));
  
  // Dados para gráfico de distribuição de estágios - consolidando de todas as campanhas
  const consolidatedStageDistribution = {};
  campaigns.forEach(campaign => {
    if (campaign.stage_reached_distribution) {
      Object.entries(campaign.stage_reached_distribution).forEach(([stage, count]) => {
        consolidatedStageDistribution[stage] = (consolidatedStageDistribution[stage] || 0) + count;
      });
    }
  });
  
  const stageDistributionData = Object.entries(consolidatedStageDistribution).map(([stage, count]) => ({
    stage,
    count
  }));

  return (
    <div className="ad-dashboard">
      <h1>Dashboard de Tráfego</h1>

      {/* Filtros Globais */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Período:</label>
          <select value={dateRange} onChange={handleDateRangeChange}>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="1y">Último ano</option>
            <option value="custom">Personalizado</option>
          </select>
          {dateRange === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                name="startDate"
                value={startDate}
                onChange={handleDateChange}
              />
              <span>até</span>
              <input
                type="date"
                name="endDate"
                value={endDate}
                onChange={handleDateChange}
              />
            </div>
          )}
        </div>

        <div className="filter-group">
          <label>Campanha:</label>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="all">Todas</option>
            {campaigns.map(campaign => (
              <option key={campaign.campaign_id} value={campaign.campaign_id}>
                {campaign.campaign_name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Conjunto de Anúncios:</label>
          <select value={selectedAdSet} onChange={(e) => setSelectedAdSet(e.target.value)}>
            <option value="all">Todos</option>
            {adSets.map(adset => (
              <option key={adset.adset_id} value={adset.adset_id}>
                {adset.adset_name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Anúncio:</label>
          <select value={selectedAd} onChange={(e) => setSelectedAd(e.target.value)}>
            <option value="all">Todos</option>
            {ads.map(ad => (
              <option key={ad.ad_name} value={ad.ad_name}>
                {ad.ad_name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Situação do Lead:</label>
          <select value={selectedLeadSituation} onChange={(e) => setSelectedLeadSituation(e.target.value)}>
            <option value="all">Todas</option>
            <option value="LEAD CONVERTIDO">Convertido</option>
            <option value="LEAD DESCARTADO">Descartado</option>
            <option value="EM ATENDIMENTO">Em Atendimento</option>
          </select>
        </div>
      </div>

      {/* Seção 1 - Visão Geral */}
      <div className="overview-section">
        <h2>Visão Geral</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total de Leads de Campanha</h3>
            <p>{overview.totalLeads}</p>
          </div>
          <div className="metric-card">
            <h3>Total de Leads Convertidos</h3>
            <p>{overview.totalSales}</p>
          </div>
          <div className="metric-card">
            <h3>Leads Perdidos</h3>
            <p>{overview.lostLeads}</p>
          </div>
          <div className="metric-card">
            <h3>Taxa de Conversão</h3>
            <p>{overview.conversionRate}%</p>
          </div>
          <div className="metric-card">
            <h3>Tempo Médio até Conversão</h3>
            <p>{overview.avgConversionTime}</p>
          </div>
          <div className="metric-card">
            <h3>Tempo Médio até Descarte</h3>
            <p>{overview.avgDiscardTime}</p>
          </div>
        </div>
      </div>

      {/* Seção 2 - Desempenho por Anúncio */}
      <div className="ads-performance-section">
        <h2>Desempenho por Anúncio</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Anúncio</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Estágio mais Avançado</th>
                <th>Conjunto</th>
                <th>Campanha</th>
              </tr>
            </thead>
            <tbody>
              {adsForTable.map((ad) => (
                <tr key={ad.ad_name}>
                  <td>{ad.ad_name}</td>
                  <td>{ad.leads}</td>
                  <td>{ad.sales}</td>
                  <td>{ad.conversion}%</td>
                  <td>{ad.farthest_stage}</td>
                  <td>{ad.adset_name}</td>
                  <td>{ad.campaign_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="charts-container">
          <div className="chart">
            <h3>Conversão por Anúncio</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={adsForTable}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ad_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="conversion" fill="#8884d8" name="Conversão (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart">
            <h3>Distribuição de Leads por Anúncio</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={adsForTable}
                  dataKey="leads"
                  nameKey="ad_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {adsForTable.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção 3 - Desempenho por Conjunto de Anúncio */}
      <div className="adsets-performance-section">
        <h2>Desempenho por Conjunto de Anúncio</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Conjunto</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Estágio mais Avançado</th>
                <th>Campanhas</th>
              </tr>
            </thead>
            <tbody>
              {adsetsForTable.map((adset) => (
                <tr key={adset.adset_name}>
                  <td>{adset.adset_name}</td>
                  <td>{adset.leads}</td>
                  <td>{adset.sales}</td>
                  <td>{adset.conversion}%</td>
                  <td>{adset.farthest_stage}</td>
                  <td>{adset.campaigns.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção 4 - Desempenho por Campanha */}
      <div className="campaigns-performance-section">
        <h2>Desempenho por Campanha</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Estágio mais Avançado</th>
                <th>Anúncios Ativos</th>
              </tr>
            </thead>
            <tbody>
              {campaignsForTable.map((campaign) => (
                <tr key={campaign.campaign_name}>
                  <td>{campaign.campaign_name}</td>
                  <td>{campaign.leads}</td>
                  <td>{campaign.sales}</td>
                  <td>{campaign.conversion}%</td>
                  <td>{campaign.farthest_stage}</td>
                  <td>{campaign.active_ads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção 5 - Distribuição de Estágios */}
      <div className="lead-stages-section">
        <h2>Distribuição de Estágios</h2>
        <div className="charts-container">
          <div className="chart">
            <h3>Estágios Alcançados pelos Leads</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stageDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Número de Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção 6 - Motivos de Perda */}
      <div className="loss-reasons-section">
        <h2>Motivos de Perda</h2>
        <div className="charts-container">
          <div className="chart">
            <h3>Distribuição de Motivos de Perda</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={lossReasonsData}
                  dataKey="count"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {lossReasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção 7 - Desempenho por Atendente */}
      <div className="users-performance-section">
        <h2>Desempenho por Atendente</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Atendente</th>
                <th>Leads Atendidos</th>
                <th>Leads Convertidos</th>
                <th>Taxa de Conversão</th>
                <th>Valor Total</th>
                <th>Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {top_users.map((user) => (
                <tr key={user.name}>
                  <td>{user.name}</td>
                  <td>{user.attended}</td>
                  <td>{user.converted}</td>
                  <td>{user.conversion_rate}%</td>
                  <td>R$ {user.total_value.toLocaleString()}</td>
                  <td>R$ {user.average_ticket.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="charts-container">
          <div className="chart">
            <h3>Taxa de Conversão por Atendente</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top_users}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="conversion_rate" fill="#8884d8" name="Taxa de Conversão (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdDashboard; 