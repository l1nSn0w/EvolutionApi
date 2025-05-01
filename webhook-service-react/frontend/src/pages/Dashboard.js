import React, { useState, useEffect } from 'react';
import kommoService from '../services/kommoService';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipelineData, setPipelineData] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [loadingStages, setLoadingStages] = useState(false);
  const [pipelineLeads, setPipelineLeads] = useState({});

  useEffect(() => {
    const fetchKommoPipelines = async () => {
      try {
        // Verificar se o usuário está autenticado no Kommo
        const authStatus = await kommoService.checkAuthStatus();
        
        if (!authStatus.authenticated) {
          setError('Você precisa estar autenticado no Kommo para visualizar o dashboard.');
          setLoading(false);
          return;
        }

        // Buscar todos os pipelines
        const pipelinesResponse = await kommoService.getPipelines();
        
        if (!pipelinesResponse.success) {
          setError(pipelinesResponse.message || 'Erro ao buscar pipelines do Kommo.');
          setLoading(false);
          return;
        }

        // Exibir os pipelines no console
        console.log('Pipelines recebidos:', pipelinesResponse.pipelines);
        
        // Armazenar os pipelines no estado
        setPipelineData(pipelinesResponse.pipelines);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar pipelines do Kommo:', err);
        setError('Erro ao carregar dados do Kommo. Por favor, tente novamente mais tarde.');
        setLoading(false);
      }
    };

    fetchKommoPipelines();
  }, []);

  const handlePipelineClick = async (pipeline) => {
    try {
      setSelectedPipeline(pipeline);
      setLoadingStages(true);
      
      // Buscar os estágios do pipeline
      const stagesResponse = await kommoService.getPipelineStages(pipeline.id);
      
      if (!stagesResponse.success) {
        console.error('Erro ao buscar estágios do pipeline:', stagesResponse.message);
        setSelectedPipeline({ ...pipeline, stages: [] });
        setLoadingStages(false);
        return;
      }

      // Buscar os leads da tabela de tracking
      const leadsResponse = await kommoService.getPipelineTrackingLeads(pipeline.id);
      console.log('Leads encontrados na tabela de tracking:', leadsResponse);
      setPipelineLeads(leadsResponse || {});
      
      // Atualizar o pipeline selecionado com os estágios
      setSelectedPipeline({
        ...pipeline,
        stages: stagesResponse.stages
      });
      
      setLoadingStages(false);
    } catch (err) {
      console.error('Erro ao buscar dados do pipeline:', err);
      setSelectedPipeline({ ...pipeline, stages: [] });
      setLoadingStages(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard de Campanhas Facebook</h1>
      
      <div className="dashboard-content">
        <div className="pipelines-section">
          <h2>Pipelines</h2>
          {pipelineData.length === 0 ? (
            <p>Nenhum pipeline encontrado.</p>
          ) : (
            <ul className="pipelines-list">
              {pipelineData.map(pipeline => (
                <li 
                  key={pipeline.id} 
                  className={`pipeline-item ${selectedPipeline && selectedPipeline.id === pipeline.id ? 'active' : ''}`}
                  onClick={() => handlePipelineClick(pipeline)}
                >
                  <h3>{pipeline.name}</h3>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="kanban-container">
          {selectedPipeline ? (
            <>
              <h2>{selectedPipeline.name}</h2>
              {loadingStages ? (
                <div className="loading-stages">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando estágios...</span>
                  </div>
                </div>
              ) : (
                <div className="kanban-board">
                  {selectedPipeline.stages && selectedPipeline.stages.length > 0 ? (
                    selectedPipeline.stages.map(stage => {
                      console.log(`Renderizando estágio ${stage.id}:`, stage);
                      console.log(`Tipo do ID do estágio:`, typeof stage.id);
                      console.log(`Leads para este estágio:`, pipelineLeads[stage.id]);
                      console.log(`Chaves disponíveis em pipelineLeads:`, Object.keys(pipelineLeads));
                      return (
                        <div key={stage.id} className="kanban-column">
                          <div className="kanban-column-header">
                            <h3>{stage.name}</h3>
                          </div>
                          <div className="kanban-column-content">
                            {pipelineLeads[stage.id] && pipelineLeads[stage.id].length > 0 ? (
                              pipelineLeads[stage.id].map(lead => (
                                <div key={lead.lead_id} className="lead-card">
                                  <div className="lead-info">
                                    <p className="lead-id">ID: {lead.lead_id}</p>
                                    {lead.phone && <p className="lead-phone">Tel: {lead.phone}</p>}
                                    {lead.lead_situation && (
                                      <p className="lead-situation">
                                        Situação: <span className="badge bg-info">{lead.lead_situation}</span>
                                      </p>
                                    )}
                                    {lead.campaign_name && (
                                      <p className="lead-campaign">
                                        Campanha: <span className="badge bg-primary">{lead.campaign_name}</span>
                                      </p>
                                    )}
                                    {lead.adset_name && (
                                      <p className="lead-adset">
                                        Conjunto: <span className="badge bg-secondary">{lead.adset_name}</span>
                                      </p>
                                    )}
                                    {lead.ad_name && (
                                      <p className="lead-ad">
                                        Anúncio: <span className="badge bg-dark">{lead.ad_name}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="empty-stage">
                                <p>Nenhum lead neste estágio</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-stages">
                      <p>Nenhum estágio encontrado neste pipeline.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="no-pipeline-selected">
              <p>Selecione um pipeline para visualizar os estágios.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 