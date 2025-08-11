// src/lib/services/warmup-service.ts
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { EventEmitter } from "events";

import { db } from "@/db";
import {
  DEFAULT_EXTERNAL_NUMBERS,
  DEFAULT_EXTERNAL_NUMBERS_CHANCE,
  DEFAULT_GROUP_CHANCE,
  DEFAULT_GROUP_ID,
  instancesTables,
  type MediaStats,
  mediaStatsTables,
  PLAN_LIMITS,
  usersTables,
  type WarmupConfig,
  warmupConfigsTables,
  type WarmupContent,
  warmupContentsTables,
  warmupLogsTables,
  type WarmupStats,
  warmupStatsTables,
} from "@/db/schema";

const EVOLUTION_API_BASE_URL = process.env.EVOLUTION_API_BASE_URL;

interface InstanceWorker {
  instanceId: string;
  userId: string;
  configId: string;
  timer: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  lastActivity: Date;
  messageCount: number;
  errorCount: number;
  retryCount: number;
  lastErrorAt: Date | null;
  status: "active" | "paused" | "error" | "stopped";
}

export class WarmupService extends EventEmitter {
  private workers: Map<string, InstanceWorker> = new Map();
  private isShutdown = false;
  private maxWorkers = 500;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private workerQueue: Array<{
    instanceId: string;
    userId: string;
    configId: string;
  }> = [];
  private isProcessingQueue = false;

  constructor() {
    super();
    this.startCleanupInterval();
    this.startStatsInterval();
    this.startHealthCheckInterval();
    this.startQueueProcessor();
  }

  async startWarmup(
    userId: string,
    configId: string,
    instanceIds: string[],
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    try {
      const user = await db.query.usersTables.findFirst({
        where: eq(usersTables.id, userId),
      });

      if (!user) {
        return { success: false, message: "Usuário não encontrado" };
      }

      const planLimits =
        PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.FREE;

      if (instanceIds.length > planLimits.maxInstances) {
        return {
          success: false,
          message: `Seu plano permite no máximo ${planLimits.maxInstances} instâncias simultâneas`,
        };
      }

      const config = await db.query.warmupConfigsTables.findFirst({
        where: and(
          eq(warmupConfigsTables.id, configId),
          eq(warmupConfigsTables.userId, userId),
          eq(warmupConfigsTables.isActive, true),
        ),
      });

      if (!config) {
        return {
          success: false,
          message: "Configuração não encontrada ou inativa",
        };
      }

      const activeWorkers = instanceIds.filter(
        (id) => this.workers.has(id) && this.workers.get(id)!.isRunning,
      );
      if (activeWorkers.length > 0) {
        return {
          success: false,
          message: `Instâncias já estão em aquecimento: ${activeWorkers.join(", ")}`,
        };
      }

      // Adicionar instâncias à fila
      for (const instanceId of instanceIds) {
        if (this.workers.size >= this.maxWorkers) {
          this.workerQueue.push({ instanceId, userId, configId });
        } else {
          await this.createWorker(instanceId, userId, configId);
        }
      }

      return {
        success: true,
        message: `Aquecimento iniciado para ${instanceIds.length} instâncias`,
      };
    } catch (error) {
      console.error("[startWarmup] Erro:", error);
      return { success: false, message: "Erro interno ao iniciar aquecimento" };
    }
  }

  async stopWarmup(
    userId: string,
    instanceIds: string[],
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    try {
      const errors: string[] = [];
      let stoppedCount = 0;

      for (const instanceId of instanceIds) {
        try {
          const worker = this.workers.get(instanceId);
          if (worker && worker.userId === userId) {
            await this.destroyWorker(instanceId);
            stoppedCount++;
          }
        } catch (error) {
          errors.push(`Erro ao parar instância ${instanceId}: ${error}`);
        }
      }

      // Remover da fila também
      this.workerQueue = this.workerQueue.filter(
        (item) =>
          !(instanceIds.includes(item.instanceId) && item.userId === userId),
      );

      if (errors.length > 0) {
        return {
          success: false,
          message: `Parado ${stoppedCount} instâncias com ${errors.length} erros`,
          errors,
        };
      }

      return {
        success: true,
        message: `Aquecimento parado para ${stoppedCount} instâncias`,
      };
    } catch (error) {
      console.error("[stopWarmup] Erro:", error);
      return { success: false, message: "Erro interno ao parar aquecimento" };
    }
  }

  async stopAllUserWarmup(userId: string): Promise<void> {
    const userWorkers = Array.from(this.workers.entries()).filter(
      ([_, worker]) => worker.userId === userId,
    );

    for (const [instanceId, _] of userWorkers) {
      await this.destroyWorker(instanceId);
    }

    // Limpar fila do usuário
    this.workerQueue = this.workerQueue.filter(
      (item) => item.userId !== userId,
    );
  }

  getServiceStats(): {
    totalWorkers: number;
    activeWorkers: number;
    pausedWorkers: number;
    errorWorkers: number;
    stoppedWorkers: number;
    workers: Array<{
      instanceId: string;
      userId: string;
      isRunning: boolean;
      messageCount: number;
      errorCount: number;
      lastActivity: Date;
      status: string;
    }>;
  } {
    const workers = Array.from(this.workers.values());

    return {
      totalWorkers: workers.length,
      activeWorkers: workers.filter((w) => w.status === "active").length,
      pausedWorkers: workers.filter((w) => w.status === "paused").length,
      errorWorkers: workers.filter((w) => w.status === "error").length,
      stoppedWorkers: workers.filter((w) => w.status === "stopped").length,
      workers: workers.map((w) => ({
        instanceId: w.instanceId,
        userId: w.userId,
        isRunning: w.isRunning,
        messageCount: w.messageCount,
        errorCount: w.errorCount,
        lastActivity: w.lastActivity,
        status: w.status,
      })),
    };
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    while (this.workerQueue.length > 0 && this.workers.size < this.maxWorkers) {
      const item = this.workerQueue.shift();
      if (item) {
        try {
          await this.createWorker(item.instanceId, item.userId, item.configId);
        } catch (error) {
          console.error(`[startQueueProcessor] Erro ao criar worker:`, error);
          // Recolocar na fila para tentar novamente
          this.workerQueue.push(item);
        }
      }
    }

    this.isProcessingQueue = false;

    // Agendar próxima execução se ainda houver itens na fila
    if (this.workerQueue.length > 0) {
      setTimeout(() => this.startQueueProcessor(), 1000);
    }
  }

  private async createWorker(
    instanceId: string,
    userId: string,
    configId: string,
  ): Promise<void> {
    try {
      // Verificar se a instância existe e está ativa
      const instance = await db.query.instancesTables.findFirst({
        where: eq(instancesTables.instanceId, instanceId),
      });

      if (!instance || !instance.isActive) {
        throw new Error(`Instância ${instanceId} não encontrada ou inativa`);
      }

      // Verificar se já existe um worker para esta instância
      if (this.workers.has(instanceId)) {
        throw new Error(`Worker já existe para instância ${instanceId}`);
      }

      // Buscar configuração
      const config = await db.query.warmupConfigsTables.findFirst({
        where: eq(warmupConfigsTables.id, configId),
      });

      if (!config) {
        throw new Error(`Configuração ${configId} não encontrada`);
      }

      // Buscar conteúdos
      const contents = await db.query.warmupContentsTables.findMany({
        where: and(
          eq(warmupContentsTables.configId, configId),
          eq(warmupContentsTables.isActive, true),
        ),
      });

      if (contents.length === 0) {
        throw new Error(
          `Nenhum conteúdo encontrado para configuração ${configId}`,
        );
      }

      // Criar worker
      const worker: InstanceWorker = {
        instanceId,
        userId,
        configId,
        timer: null,
        isRunning: true,
        lastActivity: new Date(),
        messageCount: 0,
        errorCount: 0,
        retryCount: 0,
        lastErrorAt: null,
        status: "active",
      };

      this.workers.set(instanceId, worker);

      // Inicializar estatísticas
      await this.initializeStats(instanceId, userId, configId);

      // Iniciar loop do worker
      this.runWorkerLoop(instanceId, { ...config, contents });

      console.log(`[createWorker] Worker criado para instância ${instanceId}`);
    } catch (error) {
      console.error(`[createWorker] Erro para instância ${instanceId}:`, error);
      throw error;
    }
  }

  private async destroyWorker(instanceId: string): Promise<void> {
    const worker = this.workers.get(instanceId);
    if (!worker) return;

    // Parar timer
    if (worker.timer) {
      clearInterval(worker.timer);
      worker.timer = null;
    }

    // Atualizar estatísticas
    await db
      .update(warmupStatsTables)
      .set({
        status: "stopped",
        isRunning: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, worker.userId),
        ),
      );

    // Remover worker
    this.workers.delete(instanceId);

    console.log(
      `[destroyWorker] Worker destruído para instância ${instanceId}`,
    );
  }

  private runWorkerLoop(
    instanceId: string,
    config: WarmupConfig & { contents: WarmupContent[] },
  ): Promise<void> {
    return new Promise((resolve) => {
      const sendMessage = async () => {
        try {
          const worker = this.workers.get(instanceId);
          if (!worker || !worker.isRunning || worker.status !== "active") {
            resolve();
            return;
          }

          // Verificar limite diário
          if (!(await this.checkDailyLimit(instanceId, worker.userId))) {
            console.log(
              `[runWorkerLoop] Limite diário atingido para instância ${instanceId}`,
            );
            resolve();
            return;
          }

          // Selecionar tipo de mensagem
          const messageType = this.selectMessageType(config);

          // Selecionar conteúdo
          const content = this.selectContent(config.contents, messageType);
          if (!content) {
            console.log(
              `[runWorkerLoop] Nenhum conteúdo disponível para tipo ${messageType}`,
            );
            resolve();
            return;
          }

          // Selecionar destino
          const destination = await this.selectDestination(config);

          // Enviar mensagem
          const success = await this.sendMessage(
            instanceId,
            destination.targets[0], // Por enquanto, enviar para o primeiro destino
            content,
            messageType,
            worker.userId,
          );

          if (success) {
            worker.messageCount++;
            worker.lastActivity = new Date();

            // Atualizar estatísticas
            await this.updateStats(
              instanceId,
              worker.userId,
              messageType,
              true,
            );

            // Log da ação
            await this.logAction(
              instanceId,
              worker.userId,
              "message_sent",
              messageType,
              destination.targets[0],
              true,
            );
          } else {
            worker.errorCount++;
            worker.lastErrorAt = new Date();

            // Log do erro
            await this.logAction(
              instanceId,
              worker.userId,
              "message_failed",
              messageType,
              destination.targets[0],
              false,
              "Falha ao enviar mensagem",
            );

            // Verificar se deve pausar o worker
            if (worker.errorCount >= config.maxRetries) {
              await this.pauseWorker(instanceId);
              resolve();
              return;
            }
          }

          // Simular comportamento humano
          const delay =
            Math.random() *
              (config.messageIntervalMax - config.messageIntervalMin) +
            config.messageIntervalMin;

          setTimeout(sendMessage, delay * 1000);
        } catch (error) {
          console.error(
            `[runWorkerLoop] Erro para instância ${instanceId}:`,
            error,
          );

          const worker = this.workers.get(instanceId);
          if (worker) {
            worker.errorCount++;
            worker.lastErrorAt = new Date();
          }

          resolve();
        }
      };

      // Iniciar loop
      sendMessage();
    });
  }

  private async checkDailyLimit(
    instanceId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const stats = await db.query.warmupStatsTables.findFirst({
        where: and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, userId),
        ),
      });

      if (!stats) return false;

      const config = await db.query.warmupConfigsTables.findFirst({
        where: eq(warmupConfigsTables.id, stats.configId),
      });

      if (!config) return false;

      return stats.dailyMessagesSent < config.dailyMessageLimit;
    } catch (error) {
      console.error(`[checkDailyLimit] Erro:`, error);
      return false;
    }
  }

  private async pauseWorker(instanceId: string): Promise<void> {
    const worker = this.workers.get(instanceId);
    if (!worker) return;

    worker.status = "paused";
    worker.isRunning = false;

    if (worker.timer) {
      clearInterval(worker.timer);
      worker.timer = null;
    }

    await db
      .update(warmupStatsTables)
      .set({
        status: "paused",
        isRunning: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, worker.userId),
        ),
      );

    // Tentar reativar após 5 minutos
    setTimeout(
      async () => {
        if (worker.status === "paused") {
          worker.status = "active";
          worker.isRunning = true;
          worker.retryCount = 0;

          const config = await db.query.warmupConfigsTables.findFirst({
            where: eq(warmupConfigsTables.id, worker.configId),
          });

          if (config) {
            const contents = await db.query.warmupContentsTables.findMany({
              where: and(
                eq(warmupContentsTables.configId, worker.configId),
                eq(warmupContentsTables.isActive, true),
              ),
            });

            this.runWorkerLoop(instanceId, { ...config, contents });
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  private selectMessageType(config: WarmupConfig): string {
    const types = [];

    if (config.enableMediaMessages) {
      types.push("text", "image", "video", "audio", "sticker");
    } else {
      types.push("text");
    }

    if (config.enableReactions) {
      types.push("reaction");
    }

    if (config.enableReplies) {
      types.push("reply");
    }

    return types[Math.floor(Math.random() * types.length)];
  }

  private selectContent(
    contents: WarmupContent[],
    messageType: string,
  ): WarmupContent | null {
    const availableContents = contents.filter(
      (c) =>
        c.type === messageType &&
        c.isActive &&
        c.currentDailyUsage < c.maxUsagePerDay,
    );

    if (availableContents.length === 0) return null;

    const totalWeight = availableContents.reduce(
      (sum, c) => sum + c.usageWeight,
      0,
    );
    let random = Math.random() * totalWeight;

    for (const content of availableContents) {
      random -= content.usageWeight;
      if (random <= 0) {
        return content;
      }
    }

    return availableContents[0];
  }

  private async selectDestination(
    config: WarmupConfig,
  ): Promise<{ isGroup: boolean; targets: string[] }> {
    const isGroup = Math.random() * 100 < config.groupMessageChance;

    if (
      isGroup &&
      config.enableGroupMessages &&
      (config.targetGroups as string[]).length > 0
    ) {
      return {
        isGroup: true,
        targets: config.targetGroups as string[],
      };
    }

    const targets = [...(config.targetNumbers as string[])];

    if (
      config.useExternalNumbers &&
      Math.random() * 100 < config.externalNumbersChance
    ) {
      targets.push(...DEFAULT_EXTERNAL_NUMBERS);
    }

    return {
      isGroup: false,
      targets: targets.length > 0 ? targets : DEFAULT_EXTERNAL_NUMBERS,
    };
  }

  private async sendMessage(
    instanceId: string,
    target: string,
    content: WarmupContent,
    messageType: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const endpoint = `${EVOLUTION_API_BASE_URL}/message/sendText/${instanceId}`;

      let payload: any = {
        number: target,
        textMessage: { text: content.content },
      };

      switch (messageType) {
        case "image":
          payload = {
            number: target,
            imageMessage: {
              image: content.content,
              caption: content.caption || "",
            },
          };
          break;

        case "video":
          payload = {
            number: target,
            videoMessage: {
              video: content.content,
              caption: content.caption || "",
            },
          };
          break;

        case "audio":
          payload = {
            number: target,
            audioMessage: {
              audio: content.content,
            },
          };
          break;

        case "sticker":
          payload = {
            number: target,
            stickerMessage: {
              sticker: content.content,
            },
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.status === "success";
    } catch (error) {
      console.error(`[sendMessage] Erro para instância ${instanceId}:`, error);
      return false;
    }
  }

  private async initializeStats(
    instanceId: string,
    userId: string,
    configId: string,
  ): Promise<void> {
    try {
      // Verificar se já existem estatísticas
      const existingStats = await db.query.warmupStatsTables.findFirst({
        where: and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, userId),
        ),
      });

      if (existingStats) {
        // Atualizar estatísticas existentes
        await db
          .update(warmupStatsTables)
          .set({
            status: "active",
            isRunning: true,
            updatedAt: new Date(),
          })
          .where(eq(warmupStatsTables.id, existingStats.id));
      } else {
        // Criar novas estatísticas
        await db.insert(warmupStatsTables).values({
          id: `${instanceId}_${userId}_${Date.now()}`,
          instanceId,
          userId,
          configId,
          status: "active",
          isRunning: true,
          totalMessagesSent: 0,
          dailyMessagesSent: 0,
          monthlyMessagesSent: 0,
          textMessagesSent: 0,
          imageMessagesSent: 0,
          videoMessagesSent: 0,
          audioMessagesSent: 0,
          stickerMessagesSent: 0,
          buttonMessagesSent: 0,
          listMessagesSent: 0,
          reactionMessagesSent: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Inicializar estatísticas de mídia
      const existingMediaStats = await db.query.mediaStatsTables.findFirst({
        where: and(
          eq(mediaStatsTables.instanceId, instanceId),
          eq(mediaStatsTables.userId, userId),
        ),
      });

      if (!existingMediaStats) {
        await db.insert(mediaStatsTables).values({
          id: `${instanceId}_${userId}_media_${Date.now()}`,
          instanceId,
          userId,
          date: new Date(),
          isReceived: false,
          textCount: 0,
          imageCount: 0,
          videoCount: 0,
          audioCount: 0,
          stickerCount: 0,
          buttonCount: 0,
          listCount: 0,
          reactionCount: 0,
          totalDaily: 0,
          totalAllTime: 0,
        });
      }
    } catch (error) {
      console.error(
        `[initializeStats] Erro para instância ${instanceId}:`,
        error,
      );
    }
  }

  private async updateStats(
    instanceId: string,
    userId: string,
    messageType: string,
    isSent: boolean,
  ): Promise<void> {
    try {
      const stats = await db.query.warmupStatsTables.findFirst({
        where: and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, userId),
        ),
      });

      if (!stats) return;

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (isSent) {
        updateData.totalMessagesSent = stats.totalMessagesSent + 1;
        updateData.dailyMessagesSent = stats.dailyMessagesSent + 1;
        updateData.monthlyMessagesSent = stats.monthlyMessagesSent + 1;

        // Incrementar contador específico do tipo
        switch (messageType) {
          case "text":
            updateData.textMessagesSent = stats.textMessagesSent + 1;
            break;
          case "image":
            updateData.imageMessagesSent = stats.imageMessagesSent + 1;
            break;
          case "video":
            updateData.videoMessagesSent = stats.videoMessagesSent + 1;
            break;
          case "audio":
            updateData.audioMessagesSent = stats.audioMessagesSent + 1;
            break;
          case "sticker":
            updateData.stickerMessagesSent = stats.stickerMessagesSent + 1;
            break;
          case "button":
            updateData.buttonMessagesSent = stats.buttonMessagesSent + 1;
            break;
          case "list":
            updateData.listMessagesSent = stats.listMessagesSent + 1;
            break;
          case "reaction":
            updateData.reactionMessagesSent = stats.reactionMessagesSent + 1;
            break;
        }
      }

      await db
        .update(warmupStatsTables)
        .set(updateData)
        .where(eq(warmupStatsTables.id, stats.id));

      // Atualizar estatísticas de mídia se aplicável
      if (
        isSent &&
        ["image", "video", "audio", "sticker"].includes(messageType)
      ) {
        const mediaStats = await db.query.mediaStatsTables.findFirst({
          where: and(
            eq(mediaStatsTables.instanceId, instanceId),
            eq(mediaStatsTables.userId, userId),
          ),
        });

        if (mediaStats) {
          const mediaUpdateData: any = {
            updatedAt: new Date(),
          };

          switch (messageType) {
            case "image":
              mediaUpdateData.imageCount = mediaStats.imageCount + 1;
              break;
            case "video":
              mediaUpdateData.videoCount = mediaStats.videoCount + 1;
              break;
            case "audio":
              mediaUpdateData.audioCount = mediaStats.audioCount + 1;
              break;
            case "sticker":
              mediaUpdateData.stickerCount = mediaStats.stickerCount + 1;
              break;
          }

          await db
            .update(mediaStatsTables)
            .set(mediaUpdateData)
            .where(eq(mediaStatsTables.id, mediaStats.id));
        }
      }
    } catch (error) {
      console.error(`[updateStats] Erro para instância ${instanceId}:`, error);
    }
  }

  private async logAction(
    instanceId: string,
    userId: string,
    action: string,
    messageType: string | null,
    target: string | null,
    success: boolean,
    details?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await db.insert(warmupLogsTables).values({
        id: `${instanceId}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        instanceId,
        userId,
        action,
        messageType,
        target,
        success,
        details: details || null,
        errorMessage: errorMessage || null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error(`[logAction] Erro ao registrar log:`, error);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupInactiveWorkers();
      },
      5 * 60 * 1000,
    ); // A cada 5 minutos
  }

  private startStatsInterval(): void {
    this.statsInterval = setInterval(() => {
      this.updateAllStats();
    }, 60 * 1000); // A cada minuto
  }

  private startHealthCheckInterval(): void {
    this.healthCheckInterval = setInterval(
      () => {
        this.healthCheck();
      },
      2 * 60 * 1000,
    ); // A cada 2 minutos
  }

  private async cleanupInactiveWorkers(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutos

    for (const [instanceId, worker] of Array.from(this.workers.entries())) {
      if (worker.lastActivity.getTime() < now.getTime() - inactiveThreshold) {
        console.log(
          `[cleanupInactiveWorkers] Removendo worker inativo: ${instanceId}`,
        );
        await this.destroyWorker(instanceId);
      }
    }
  }

  private async updateAllStats(): Promise<void> {
    // Atualizar estatísticas de todos os workers ativos
    for (const [instanceId, worker] of Array.from(this.workers.entries())) {
      if (worker.isRunning) {
        worker.lastActivity = new Date();
      }
    }
  }

  private async resetDailyCounters(): Promise<void> {
    try {
      // Resetar contadores diários de todas as estatísticas
      await db
        .update(warmupStatsTables)
        .set({
          dailyMessagesSent: 0,
          updatedAt: new Date(),
        })
        .where(sql`DATE(updated_at) < CURRENT_DATE`);

      // Resetar contadores diários de conteúdo
      await db
        .update(warmupContentsTables)
        .set({
          currentDailyUsage: 0,
          updatedAt: new Date(),
        })
        .where(sql`DATE(updated_at) < CURRENT_DATE`);

      console.log("[resetDailyCounters] Contadores diários resetados");
    } catch (error) {
      console.error("[resetDailyCounters] Erro:", error);
    }
  }

  private healthCheck(): void {
    const stats = this.getServiceStats();

    // Verificar se há muitos workers com erro
    if (stats.errorWorkers > stats.totalWorkers * 0.1) {
      // Mais de 10% com erro
      console.warn("[healthCheck] Muitos workers com erro detectados");
      this.emit("health_warning", {
        errorWorkers: stats.errorWorkers,
        totalWorkers: stats.totalWorkers,
      });
    }

    // Verificar se há workers travados
    const now = new Date();
    for (const [instanceId, worker] of Array.from(this.workers.entries())) {
      if (
        worker.isRunning &&
        worker.lastActivity.getTime() < now.getTime() - 10 * 60 * 1000
      ) {
        console.warn(`[healthCheck] Worker travado detectado: ${instanceId}`);
        this.emit("worker_stuck", {
          instanceId,
          lastActivity: worker.lastActivity,
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return;

    this.isShutdown = true;

    // Parar todos os timers
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

    // Parar todos os workers
    for (const [instanceId, _] of Array.from(this.workers.entries())) {
      await this.destroyWorker(instanceId);
    }

    // Limpar fila
    this.workerQueue = [];

    console.log("[shutdown] WarmupService encerrado");
  }
}

// Instância singleton
export const warmupService = new WarmupService();
