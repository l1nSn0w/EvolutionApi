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
        // Usando a nova rota campaign-analytics
        const response = await fetch(`${API_URL}/dashboard/campaign-analytics`);
        
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

  // Função auxiliar para formatar milissegundos em formato legível
  const formatTimeInMs = (ms) => {
    if (!ms && ms !== 0) return 'N/A';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  // Função para determinar a classe de estilo para taxas de descarte
  const getDiscardRateClass = (rate) => {
    if (rate >= 30) return 'discard-rate-high';
    if (rate >= 15) return 'discard-rate-medium';
    return 'discard-rate-low';
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
  const { campaigns, ad_sets, ads, total_contacts, total_clicks, processed_at } = metricsData;
  
  // Calcular métricas gerais
  const overview = {
    totalContacts: total_contacts || 0,
    totalClicks: total_clicks || 0,
    totalLeads: campaigns.reduce((sum, campaign) => sum + (campaign.total_leads || 0), 0),
    totalSales: campaigns.reduce((sum, campaign) => sum + (campaign.converted_leads || 0), 0),
    totalDiscards: campaigns.reduce((sum, campaign) => sum + (campaign.discarded_leads || 0), 0),
    totalValue: campaigns.reduce((sum, campaign) => sum + (campaign.total_value || 0), 0),
    clicksPerContact: (total_clicks / total_contacts).toFixed(2) || 0,
    conversionRate: campaigns.length > 0 ? 
      parseFloat((campaigns.reduce((sum, campaign) => sum + (campaign.converted_leads || 0), 0) / 
       campaigns.reduce((sum, campaign) => sum + (campaign.total_leads || 0), 0) * 100).toFixed(2)) : 0,
    discardRate: campaigns.length > 0 ? 
      parseFloat((campaigns.reduce((sum, campaign) => sum + (campaign.discarded_leads || 0), 0) / 
       campaigns.reduce((sum, campaign) => sum + (campaign.total_leads || 0), 0) * 100).toFixed(2)) : 0,
    avgConversionTime: formatTimeInMs(campaigns.find(c => c.average_conversion_time_ms)?.average_conversion_time_ms || 0),
    avgDiscardTime: formatTimeInMs(campaigns.find(c => c.average_discard_time_ms)?.average_discard_time_ms || 0),
    avgTicket: campaigns.reduce((sum, campaign) => sum + (campaign.total_value || 0), 0) / 
      campaigns.reduce((sum, campaign) => sum + (campaign.converted_leads || 0), 0) || 0
  };
  
  // Preparar dados para gráficos e tabelas
  const adsForTable = ads.map(ad => {
    return {
      ad_name: ad.ad_name,
      leads: ad.total_leads,
      sales: ad.converted_leads,
      discards: ad.discarded_leads || 0,
      conversion: ad.conversion_rate,
      discard_rate: ad.discard_rate || 0,
      clicks: ad.total_clicks,
      clicks_per_contact: ad.clicks_per_contact,
      adset_name: ad.adset_name,
      campaign_name: ad.campaign_name,
      average_ticket: ad.average_ticket
    };
  });
  
  const adsetsForTable = ad_sets.map(adset => {
    return {
      adset_name: adset.adset_name,
      adset_id: adset.adset_id,
      leads: adset.total_leads,
      clicks: adset.total_clicks,
      sales: adset.converted_leads,
      discards: adset.discarded_leads || 0,
      conversion: adset.conversion_rate,
      discard_rate: adset.discard_rate || 0,
      clicks_per_contact: adset.clicks_per_contact,
      campaign_name: adset.campaign_name,
      average_ticket: adset.average_ticket
    };
  });
  
  const campaignsForTable = campaigns.map(campaign => {
    // Contar número de ads associados a esta campanha
    const campaignAds = ads.filter(ad => ad.campaign_id === campaign.campaign_id).length;
    
    return {
      campaign_name: campaign.campaign_name,
      campaign_id: campaign.campaign_id,
      leads: campaign.total_leads,
      clicks: campaign.total_clicks,
      sales: campaign.converted_leads,
      discards: campaign.discarded_leads || 0,
      conversion: campaign.conversion_rate,
      discard_rate: campaign.discard_rate || 0,
      clicks_per_contact: campaign.clicks_per_contact,
      active_ads: campaignAds,
      average_ticket: campaign.average_ticket,
      total_value: campaign.total_value
    };
  });
  
  // Dados para gráfico de distribuição de status - usando status_distribution
  const statusDistributionData = [];
  campaigns.forEach(campaign => {
    if (campaign.status_distribution) {
      Object.entries(campaign.status_distribution).forEach(([status, count]) => {
        statusDistributionData.push({
          status,
          count,
          campaign: campaign.campaign_name
        });
      });
    }
  });
  
  // Preparar dados de usuários responsáveis
  const usersData = [];
  campaigns.forEach(campaign => {
    if (campaign.responsible_users) {
      campaign.responsible_users.forEach(user => {
        // Verificar se já temos este usuário
        const existingUser = usersData.find(u => u.name === user.name);
        if (existingUser) {
          // Atualizar contagens existentes
          existingUser.total_leads += user.total_leads;
          existingUser.converted_leads += user.converted_leads;
          existingUser.total_value += user.total_value;
          // Adicionar dados de descarte se disponíveis
          if (user.discarded_leads !== undefined) {
            existingUser.discarded_leads = (existingUser.discarded_leads || 0) + user.discarded_leads;
          }
        } else {
          // Adicionar novo usuário
          usersData.push({
            name: user.name,
            total_leads: user.total_leads,
            converted_leads: user.converted_leads,
            discarded_leads: user.discarded_leads || 0,
            conversion_rate: 0, // Será recalculado
            discard_rate: 0, // Será recalculado
            total_value: user.total_value,
            average_ticket: 0 // Será recalculado
          });
        }
      });
    }
  });
  
  // Recalcular métricas para usuários após agregação
  usersData.forEach(user => {
    // Recalcular taxa de conversão
    user.conversion_rate = user.total_leads > 0 
      ? parseFloat((user.converted_leads / user.total_leads * 100).toFixed(2))
      : 0;
      
    // Recalcular taxa de descarte
    user.discard_rate = user.total_leads > 0 
      ? parseFloat((user.discarded_leads / user.total_leads * 100).toFixed(2))
      : 0;
      
    // Recalcular ticket médio
    user.average_ticket = user.converted_leads > 0
      ? parseFloat((user.total_value / user.converted_leads).toFixed(2))
      : 0;
  });
  
  // Classificar usuários por número de leads
  usersData.sort((a, b) => b.total_leads - a.total_leads);

  // Preparar dados para gráfico de motivos de descarte agregados
  const discardReasonsData = metricsData.discard_metrics?.discard_reasons || [];

  return (
    <div className="ad-dashboard">
      <h1>Dashboard de Tráfego</h1>
      <p className="last-updated">Última atualização: {new Date(processed_at).toLocaleString()}</p>

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
            {ad_sets.map(adset => (
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
              <option key={`${ad.campaign_id}_${ad.adset_id}_${ad.ad_name}`} value={ad.ad_name}>
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
            <h3>Total de Contatos</h3>
            <p>{overview.totalContacts}</p>
          </div>
          <div className="metric-card">
            <h3>Total de Cliques</h3>
            <p>{overview.totalClicks}</p>
          </div>
          <div className="metric-card">
            <h3>Cliques por Contato</h3>
            <p>{overview.clicksPerContact}</p>
          </div>
          <div className="metric-card">
            <h3>Total de Leads</h3>
            <p>{overview.totalLeads}</p>
          </div>
          <div className="metric-card">
            <h3>Leads Convertidos</h3>
            <p>{overview.totalSales}</p>
          </div>
          <div className="metric-card highlight-positive">
            <h3>Taxa de Conversão</h3>
            <p>{overview.conversionRate}%</p>
          </div>
          <div className="metric-card highlight-negative">
            <h3>Leads Descartados</h3>
            <p>{overview.totalDiscards}</p>
          </div>
          <div className="metric-card highlight-negative">
            <h3>Taxa de Descarte</h3>
            <p>{overview.discardRate}%</p>
          </div>
          <div className="metric-card">
            <h3>Valor Total</h3>
            <p>R$ {overview.totalValue.toLocaleString()}</p>
          </div>
          <div className="metric-card">
            <h3>Ticket Médio</h3>
            <p>R$ {overview.avgTicket.toLocaleString()}</p>
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
                <th>Cliques</th>
                <th>Cliques/Contato</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Descartados</th>
                <th>Descarte (%)</th>
                <th>Ticket Médio</th>
                <th>Conjunto</th>
                <th>Campanha</th>
              </tr>
            </thead>
            <tbody>
              {adsForTable.map((ad) => (
                <tr key={`${ad.campaign_name}_${ad.adset_name}_${ad.ad_name}`}>
                  <td>{ad.ad_name}</td>
                  <td>{ad.clicks}</td>
                  <td>{ad.clicks_per_contact}</td>
                  <td>{ad.leads}</td>
                  <td>{ad.sales}</td>
                  <td>{ad.conversion}%</td>
                  <td>{ad.discards}</td>
                  <td className={getDiscardRateClass(ad.discard_rate)}>{ad.discard_rate}%</td>
                  <td>R$ {ad.average_ticket.toLocaleString()}</td>
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
                <th>Cliques</th>
                <th>Cliques/Contato</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Descartados</th>
                <th>Descarte (%)</th>
                <th>Ticket Médio</th>
                <th>Campanha</th>
              </tr>
            </thead>
            <tbody>
              {adsetsForTable.map((adset) => (
                <tr key={adset.adset_id}>
                  <td>{adset.adset_name}</td>
                  <td>{adset.clicks}</td>
                  <td>{adset.clicks_per_contact}</td>
                  <td>{adset.leads}</td>
                  <td>{adset.sales}</td>
                  <td>{adset.conversion}%</td>
                  <td>{adset.discards}</td>
                  <td className={getDiscardRateClass(adset.discard_rate)}>{adset.discard_rate}%</td>
                  <td>R$ {adset.average_ticket.toLocaleString()}</td>
                  <td>{adset.campaign_name}</td>
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
                <th>Cliques</th>
                <th>Cliques/Contato</th>
                <th>Leads</th>
                <th>Convertidos</th>
                <th>Conversão (%)</th>
                <th>Descartados</th>
                <th>Descarte (%)</th>
                <th>Valor Total</th>
                <th>Ticket Médio</th>
                <th>Anúncios Ativos</th>
              </tr>
            </thead>
            <tbody>
              {campaignsForTable.map((campaign) => (
                <tr key={campaign.campaign_id}>
                  <td>{campaign.campaign_name}</td>
                  <td>{campaign.clicks}</td>
                  <td>{campaign.clicks_per_contact}</td>
                  <td>{campaign.leads}</td>
                  <td>{campaign.sales}</td>
                  <td>{campaign.conversion}%</td>
                  <td>{campaign.discards}</td>
                  <td className={getDiscardRateClass(campaign.discard_rate)}>{campaign.discard_rate}%</td>
                  <td>R$ {campaign.total_value.toLocaleString()}</td>
                  <td>R$ {campaign.average_ticket.toLocaleString()}</td>
                  <td>{campaign.active_ads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção 5 - Distribuição de Status */}
      <div className="lead-status-section">
        <h2>Distribuição de Status</h2>
        <div className="charts-container">
          <div className="chart">
            <h3>Status dos Leads</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Número de Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção 6 - Desempenho por Atendente */}
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
                <th>Leads Descartados</th>
                <th>Taxa de Descarte</th>
                <th>Valor Total</th>
                <th>Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {usersData.map((user) => (
                <tr key={user.name}>
                  <td>{user.name}</td>
                  <td>{user.total_leads}</td>
                  <td>{user.converted_leads}</td>
                  <td>{user.conversion_rate}%</td>
                  <td>{user.discarded_leads}</td>
                  <td className={getDiscardRateClass(user.discard_rate)}>{user.discard_rate}%</td>
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
              <BarChart data={usersData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="conversion_rate" fill="#8884d8" name="Taxa de Conversão (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart">
            <h3>Taxa de Descarte por Atendente</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usersData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="discard_rate" fill="#FF8042" name="Taxa de Descarte (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Nova Seção - Análise de Descartes */}
      <div className="discard-analysis-section">
        <h2>Análise de Descartes</h2>
        
        <div className="charts-container">
          <div className="chart">
            <h3>Principais Motivos de Descarte</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={discardReasonsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="reason" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#FF8042" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart">
            <h3>Distribuição de Motivos de Descarte</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart className="discard-pie">
                <Pie
                  data={discardReasonsData}
                  dataKey="count"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {discardReasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Tabela de Motivos de Descarte */}
        <div className="table-container">
          <h3>Detalhamento de Motivos de Descarte</h3>
          <table className="discard-reasons-table">
            <thead>
              <tr>
                <th>Motivo</th>
                <th>Quantidade</th>
                <th>Percentual (%)</th>
              </tr>
            </thead>
            <tbody>
              {discardReasonsData.map((reason) => (
                <tr key={reason.reason}>
                  <td>{reason.reason}</td>
                  <td>{reason.count}</td>
                  <td>
                    {parseFloat(
                      (reason.count / discardReasonsData.reduce((sum, r) => sum + r.count, 0) * 100).toFixed(2)
                    )}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdDashboard; 