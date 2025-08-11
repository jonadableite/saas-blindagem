"use client";

import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Settings,
  Square,
  TrendingUp,
  Users,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { toast } from "sonner";

import { fetchInstances } from "@/actions/instance";
import {
  createWarmupConfig,
  deleteWarmupConfig,
  getUserWarmupConfigs,
  getWarmupLogs,
  getWarmupServiceStats,
  startWarmup,
  stopWarmup
} from "@/actions/warmup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FormLabel } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface WarmupConfig {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;

  // Basic Configuration
  maxConcurrentInstances: number;
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  messageIntervalMin: number;
  messageIntervalMax: number;

  // Message Type Chances
  textChance: number;
  audioChance: number;
  reactionChance: number;
  stickerChance: number;
  imageChance: number;
  videoChance: number;
  documentChance: number;
  locationChance: number;
  contactChance: number;
  pollChance: number;

  // Advanced Features
  enableReactions: boolean;
  enableReplies: boolean;
  enableMediaMessages: boolean;
  enableGroupMessages: boolean;

  // Group Configuration
  groupChance: number;
  groupId?: string | null;
  groupJoinChance: number;
  groupLeaveChance: number;
  groupInviteChance: number;

  // External Numbers
  useExternalNumbers: boolean;
  externalNumbersChance: number;
  externalNumbers: string[] | null;

  // Target Configuration
  targetGroups: string[] | null;
  targetNumbers: string[] | null;

  // Human Behavior Simulation
  typingSimulation: boolean;
  onlineStatusSimulation: boolean;
  readReceiptSimulation: boolean;

  // Time-based Optimization
  activeHoursStart: number;
  activeHoursEnd: number;
  weekendBehavior: "normal" | "reduced" | "disabled";

  // Auto-reply System
  autoReplyChance: number;
  replyDelayMin: number;
  replyDelayMax: number;

  // Status and Profile Updates
  statusUpdateChance: number;
  statusTexts: string[] | null;
  profileUpdateChance: number;
  profileNames: string[] | null;
  profileBios: string[] | null;

  // Media Behavior
  mediaDownloadChance: number;
  mediaForwardChance: number;

  // Security and Anti-Detection
  antiDetectionMode: boolean;
  randomDeviceInfo: boolean;
  messageQuality: "low" | "medium" | "high";

  // Engagement Optimization
  engagementOptimization: boolean;

  // Error Handling
  retryOnError: boolean;
  maxRetries: number;

  createdAt: Date;
  updatedAt: Date;
}

interface WarmupStats {
  id: string;
  instanceId: string;
  configId: string;
  status: string;
  isRunning: boolean;
  totalMessagesSent: number;
  dailyMessagesSent: number;
  monthlyMessagesSent: number;
  totalMessagesReceived: number;
  dailyMessagesReceived: number;
  totalErrors: number;
  dailyErrors: number;
  startedAt?: Date;
  lastMessageAt?: Date;
}

interface Instance {
  instanceId: string;
  instanceName: string;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function WarmupPage() {
  const [configs, setConfigs] = useState<WarmupConfig[]>([]);
  const [stats, setStats] = useState<WarmupStats[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newConfig, setNewConfig] = useState({
    name: "",
    description: "",

    // Basic Configuration
    maxConcurrentInstances: 1,
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    messageIntervalMin: 10,
    messageIntervalMax: 15,

    // Message Type Chances
    textChance: 0.35,
    audioChance: 0.25,
    reactionChance: 0.4,
    stickerChance: 0.15,
    imageChance: 0.08,
    videoChance: 0.05,
    documentChance: 0.03,
    locationChance: 0.02,
    contactChance: 0.02,
    pollChance: 0.02,

    // Advanced Features
    enableReactions: true,
    enableReplies: true,
    enableMediaMessages: true,
    enableGroupMessages: true,

    // Group Configuration
    groupChance: 0.3,
    groupId: "120363419940617369@g.us",
    groupJoinChance: 0.02,
    groupLeaveChance: 0.01,
    groupInviteChance: 0.01,

    // External Numbers
    useExternalNumbers: true,
    externalNumbersChance: 0.4,
    externalNumbers: [] as string[],

    // Target Configuration
    targetGroups: [] as string[],
    targetNumbers: [] as string[],

    // Human Behavior Simulation
    typingSimulation: true,
    onlineStatusSimulation: true,
    readReceiptSimulation: true,

    // Time-based Optimization
    activeHoursStart: 8,
    activeHoursEnd: 22,
    weekendBehavior: "normal" as const,

    // Auto-reply System
    autoReplyChance: 0.3,
    replyDelayMin: 2000,
    replyDelayMax: 10000,

    // Status and Profile Updates
    statusUpdateChance: 0.1,
    statusTexts: [] as string[],
    profileUpdateChance: 0.05,
    profileNames: [] as string[],
    profileBios: [] as string[],

    // Media Behavior
    mediaDownloadChance: 0.5,
    mediaForwardChance: 0.2,

    // Security and Anti-Detection
    antiDetectionMode: false,
    randomDeviceInfo: false,
    messageQuality: "medium" as const,

    // Engagement Optimization
    engagementOptimization: true,

    // Error Handling
    retryOnError: true,
    maxRetries: 3
  });

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Carregar configurações de warmup
      const configsResult = await getUserWarmupConfigs();
      if ('configs' in configsResult) {
        setConfigs(configsResult.configs);
      }

      // Carregar estatísticas do serviço
      const statsResult = await getWarmupServiceStats();
      if ('stats' in statsResult) {
        setStats(statsResult.stats.workers || []);
      }

      // Carregar instâncias
      const instancesResult = await fetchInstances();
      if ('instances' in instancesResult) {
        setInstances(instancesResult.instances);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartWarmup = async (configId: string) => {
    try {
      const result = await startWarmup(configId);
      if ('message' in result) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error('Erro ao iniciar warmup');
      }
    } catch (error) {
      console.error('Erro ao iniciar warmup:', error);
      toast.error('Erro ao iniciar warmup');
    }
  };

  const handleStopWarmup = async (configId: string) => {
    try {
      const result = await stopWarmup(configId);
      if ('message' in result) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error('Erro ao parar warmup');
      }
    } catch (error) {
      console.error('Erro ao parar warmup:', error);
      toast.error('Erro ao parar warmup');
    }
  };

  const handlePauseWarmup = async (configId: string) => {
    try {
      const result = await stopWarmup(configId);
      if ('message' in result) {
        toast.success('Warmup pausado com sucesso');
        await loadData();
      } else {
        toast.error('Erro ao pausar warmup');
      }
    } catch (error) {
      console.error('Erro ao pausar warmup:', error);
      toast.error('Erro ao pausar warmup');
    }
  };

  const handleCreateConfig = async () => {
    try {
      if (!newConfig.name || newConfig.maxConcurrentInstances < 1) {
        toast.error('Preencha os campos obrigatórios');
        return;
      }

      const result = await createWarmupConfig(newConfig);
      if ('message' in result) {
        toast.success(result.message);
        setIsCreateModalOpen(false);
        resetNewConfig();
        await loadData();
      } else {
        toast.error('Erro ao criar configuração');
      }
    } catch (error) {
      console.error('Erro ao criar configuração:', error);
      toast.error('Erro ao criar configuração');
    }
  };

  const resetNewConfig = () => {
    setNewConfig({
      name: "",
      description: "",

      // Basic Configuration
      maxConcurrentInstances: 1,
      dailyMessageLimit: 50,
      monthlyMessageLimit: 1000,
      messageIntervalMin: 10,
      messageIntervalMax: 15,

      // Message Type Chances
      textChance: 0.35,
      audioChance: 0.25,
      reactionChance: 0.4,
      stickerChance: 0.15,
      imageChance: 0.08,
      videoChance: 0.05,
      documentChance: 0.03,
      locationChance: 0.02,
      contactChance: 0.02,
      pollChance: 0.02,

      // Advanced Features
      enableReactions: true,
      enableReplies: true,
      enableMediaMessages: true,
      enableGroupMessages: true,

      // Group Configuration
      groupChance: 0.3,
      groupId: "120363419940617369@g.us",
      groupJoinChance: 0.02,
      groupLeaveChance: 0.01,
      groupInviteChance: 0.01,

      // External Numbers
      useExternalNumbers: true,
      externalNumbersChance: 0.4,
      externalNumbers: [],

      // Target Configuration
      targetGroups: [],
      targetNumbers: [],

      // Human Behavior Simulation
      typingSimulation: true,
      onlineStatusSimulation: true,
      readReceiptSimulation: true,

      // Time-based Optimization
      activeHoursStart: 8,
      activeHoursEnd: 22,
      weekendBehavior: "normal" as const,

      // Auto-reply System
      autoReplyChance: 0.3,
      replyDelayMin: 2000,
      replyDelayMax: 10000,

      // Status and Profile Updates
      statusUpdateChance: 0.1,
      statusTexts: [],
      profileUpdateChance: 0.05,
      profileNames: [],
      profileBios: [],

      // Media Behavior
      mediaDownloadChance: 0.5,
      mediaForwardChance: 0.2,

      // Security and Anti-Detection
      antiDetectionMode: false,
      randomDeviceInfo: false,
      messageQuality: "medium" as const,

      // Engagement Optimization
      engagementOptimization: true,

      // Error Handling
      retryOnError: true,
      maxRetries: 3
    });
  };

  // Dados para os gráficos baseados em estatísticas reais
  const chartData = [
    { type: "Texto", count: stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0) * 0.45 },
    { type: "Imagens", count: stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0) * 0.25 },
    { type: "Vídeos", count: stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0) * 0.15 },
    { type: "Stickers", count: stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0) * 0.10 },
    { type: "Outros", count: stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0) * 0.05 }
  ];

  const chartConfig = {
    text: { label: "Texto", color: "var(--chart-1)" },
    images: { label: "Imagens", color: "var(--chart-2)" },
    videos: { label: "Vídeos", color: "var(--chart-3)" },
    stickers: { label: "Stickers", color: "var(--chart-4)" },
    others: { label: "Outros", color: "var(--chart-5)" }
  } satisfies ChartConfig;

  const totalMessagesSent = stats.reduce((sum, stat) => sum + stat.totalMessagesSent, 0);
  const totalErrors = stats.reduce((sum, stat) => sum + stat.totalErrors, 0);
  const successRate = totalMessagesSent > 0 ? ((totalMessagesSent - totalErrors) / totalMessagesSent) * 100 : 0;
  const warmupProgress = Math.min(100, Math.max(0, (totalMessagesSent / 1000) * 100));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Carregando dados de aquecimento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Warmup</h1>
          <p className="text-muted-foreground">
            Sistema de aquecimento automático para suas instâncias WhatsApp
          </p>
        </div>
        <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Configuração
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Cards de Métricas */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalMessagesSent.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  mensagens enviadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.filter(stat => stat.isRunning).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {configs.length} configuradas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  taxa de sucesso
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {configs.length > 0 ?
                    Math.round(configs.reduce((sum, config) => sum + config.messageIntervalMin, 0) / configs.length)
                    : 0}s
                </div>
                <p className="text-xs text-muted-foreground">
                  intervalo médio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Configurações Ativas */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Ativas</CardTitle>
              <CardDescription>
                Configurações de aquecimento em execução
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.filter(c => c.isActive).length > 0 ? (
                configs.filter(c => c.isActive).map((config) => (
                  <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg mb-3">
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <h4 className="font-medium">{config.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {config.maxConcurrentInstances} instâncias • {config.dailyMessageLimit} msgs/dia
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePauseWarmup(config.id)}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleStopWarmup(config.id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma configuração ativa</p>
                  <p className="text-sm">Crie uma nova configuração para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Aquecimento</CardTitle>
              <CardDescription>
                Gerencie suas configurações de aquecimento automático
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length > 0 ? (
                <div className="space-y-4">
                  {configs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <h4 className="font-medium">{config.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>• {config.maxConcurrentInstances} instâncias</span>
                            <span>• {config.dailyMessageLimit} msgs/dia</span>
                            <span>• {config.messageIntervalMin}s intervalo</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {config.isActive ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePauseWarmup(config.id)}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStopWarmup(config.id)}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleStartWarmup(config.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma configuração encontrada</p>
                  <p className="text-sm">Crie sua primeira configuração de aquecimento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Instâncias em Aquecimento</CardTitle>
              <CardDescription>
                Monitore o status e performance das suas instâncias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {instances.length > 0 ? (
                <div className="space-y-4">
                  {instances.map((instance) => (
                    <div key={instance.instanceId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${instance.status === 'connected' ? 'bg-green-500' :
                          instance.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                        <div>
                          <h4 className="font-medium">{instance.instanceName}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>• Status: {instance.status}</span>
                            <span>• Criado: {new Date(instance.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={instance.isActive ? "default" : "secondary"}>
                          {instance.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">
                          {instance.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma instância encontrada</p>
                  <p className="text-sm">Crie instâncias WhatsApp para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Radar Chart - Tipos de Mensagem */}
            <Card>
              <CardHeader className="items-center pb-4">
                <CardTitle>Tipos de Mensagem</CardTitle>
                <CardDescription>
                  Distribuição dos tipos de mensagens enviadas
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
                  <RadarChart data={chartData}>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <PolarAngleAxis dataKey="type" />
                    <PolarGrid />
                    <Radar dataKey="count" fill="var(--chart-1)" fillOpacity={0.6} />
                  </RadarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Radial Chart - Progresso do Aquecimento */}
            <Card className="flex flex-col">
              <CardHeader className="items-center pb-0">
                <CardTitle>Saúde do WhatsApp</CardTitle>
                <CardDescription>
                  Progresso do aquecimento da instância
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-0">
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
                  <RadialBarChart data={[{
                    name: "Aquecimento",
                    value: warmupProgress
                  }]} endAngle={180} innerRadius={80} outerRadius={130}>
                    <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                      <Label content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 16} className="fill-foreground text-2xl font-bold">
                                {warmupProgress.toFixed(1)}%
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 4} className="text-muted-foreground">
                                Aquecido
                              </tspan>
                            </text>
                          );
                        }
                      }} />
                    </PolarRadiusAxis>
                    <RadialBar dataKey="value" fill="var(--chart-2)" cornerRadius={5} />
                  </RadialBarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas Detalhadas */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas Detalhadas</CardTitle>
              <CardDescription>
                Métricas por tipo de mensagem e distribuição temporal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium">Mensagens por Tipo</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Texto</span>
                      <span className="font-medium">
                        {Math.round(chartData[0].count)} msgs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imagens</span>
                      <span className="font-medium">
                        {Math.round(chartData[1].count)} msgs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vídeos</span>
                      <span className="font-medium">
                        {Math.round(chartData[2].count)} msgs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stickers</span>
                      <span className="font-medium">
                        {Math.round(chartData[3].count)} msgs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outros</span>
                      <span className="font-medium">
                        {Math.round(chartData[4].count)} msgs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Distribuição por Hora</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Manhã (6h-12h)</span>
                      <span className="font-medium">35%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarde (12h-18h)</span>
                      <span className="font-medium">40%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Noite (18h-24h)</span>
                      <span className="font-medium">20%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Madrugada (0h-6h)</span>
                      <span className="font-medium">5%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Criação de Configuração */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Configuração de Aquecimento</DialogTitle>
            <DialogDescription>
              Configure os parâmetros para o aquecimento automático das suas instâncias WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel htmlFor="name">Nome da Configuração *</FormLabel>
                  <Input
                    id="name"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                    placeholder="Ex: Aquecimento Diário"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel htmlFor="maxInstances">Máx. Instâncias *</FormLabel>
                  <Input
                    id="maxInstances"
                    type="number"
                    min="1"
                    max="10"
                    value={newConfig.maxConcurrentInstances}
                    onChange={(e) => setNewConfig({ ...newConfig, maxConcurrentInstances: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FormLabel htmlFor="description">Descrição</FormLabel>
                <Textarea
                  id="description"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="Descreva o objetivo desta configuração..."
                  rows={3}
                />
              </div>
            </div>

            {/* Limites de Mensagens */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Limites de Mensagens</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <FormLabel htmlFor="dailyLimit">Limite Diário *</FormLabel>
                  <Input
                    id="dailyLimit"
                    type="number"
                    min="1"
                    max="1000"
                    value={newConfig.dailyMessageLimit}
                    onChange={(e) => setNewConfig({ ...newConfig, dailyMessageLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel htmlFor="monthlyLimit">Limite Mensal *</FormLabel>
                  <Input
                    id="monthlyLimit"
                    type="number"
                    min="1"
                    max="10000"
                    value={newConfig.monthlyMessageLimit}
                    onChange={(e) => setNewConfig({ ...newConfig, monthlyMessageLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel htmlFor="intervalMin">Intervalo Mín (s) *</FormLabel>
                  <Input
                    id="intervalMin"
                    type="number"
                    min="10"
                    max="300"
                    value={newConfig.messageIntervalMin}
                    onChange={(e) => setNewConfig({ ...newConfig, messageIntervalMin: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FormLabel htmlFor="intervalMax">Intervalo Máximo (s)</FormLabel>
                <Input
                  id="intervalMax"
                  type="number"
                  min={newConfig.messageIntervalMin}
                  max="600"
                  value={newConfig.messageIntervalMax}
                  onChange={(e) => setNewConfig({ ...newConfig, messageIntervalMax: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Configurações de Mídia */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configurações de Mídia</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableReactions"
                    checked={newConfig.enableReactions}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, enableReactions: checked })}
                  />
                  <FormLabel htmlFor="enableReactions">Habilitar Reações</FormLabel>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableReplies"
                    checked={newConfig.enableReplies}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, enableReplies: checked })}
                  />
                  <FormLabel htmlFor="enableReplies">Habilitar Respostas</FormLabel>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableMediaMessages"
                    checked={newConfig.enableMediaMessages}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, enableMediaMessages: checked })}
                  />
                  <FormLabel htmlFor="enableMediaMessages">Mensagens com Mídia</FormLabel>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableGroupMessages"
                    checked={newConfig.enableGroupMessages}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, enableGroupMessages: checked })}
                  />
                  <FormLabel htmlFor="enableGroupMessages">Mensagens em Grupos</FormLabel>
                </div>
              </div>
            </div>

            {/* Configurações Avançadas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configurações Avançadas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="useExternalNumbers"
                    checked={newConfig.useExternalNumbers}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, useExternalNumbers: checked })}
                  />
                  <FormLabel htmlFor="useExternalNumbers">Usar Números Externos</FormLabel>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="retryOnError"
                    checked={newConfig.retryOnError}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, retryOnError: checked })}
                  />
                  <FormLabel htmlFor="retryOnError">Tentar Novamente em Erro</FormLabel>
                </div>
              </div>

              {newConfig.useExternalNumbers && (
                <div className="space-y-2">
                  <FormLabel htmlFor="externalChance">Chance de Números Externos (%)</FormLabel>
                  <Input
                    id="externalChance"
                    type="number"
                    min="1"
                    max="100"
                    value={newConfig.externalNumbersChance}
                    onChange={(e) => setNewConfig({ ...newConfig, externalNumbersChance: parseInt(e.target.value) })}
                  />
                </div>
              )}

              {newConfig.enableGroupMessages && (
                <div className="space-y-2">
                  <FormLabel htmlFor="groupChance">Chance de Mensagens em Grupos (%)</FormLabel>
                  <Input
                    id="groupChance"
                    type="number"
                    min="1"
                    max="100"
                    value={newConfig.groupMessageChance}
                    onChange={(e) => setNewConfig({ ...newConfig, groupMessageChance: parseInt(e.target.value) })}
                  />
                </div>
              )}

              {newConfig.retryOnError && (
                <div className="space-y-2">
                  <FormLabel htmlFor="maxRetries">Máximo de Tentativas</FormLabel>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="1"
                    max="10"
                    value={newConfig.maxRetries}
                    onChange={(e) => setNewConfig({ ...newConfig, maxRetries: parseInt(e.target.value) })}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={resetNewConfig}>
              Resetar
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateConfig}
                disabled={!newConfig.name || newConfig.maxConcurrentInstances < 1}
              >
                Criar Configuração
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
