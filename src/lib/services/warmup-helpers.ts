// src/lib/services/warmup-helpers.ts
import { and, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  DEFAULT_EXTERNAL_NUMBERS,
  DEFAULT_GROUP_ID,
  mediaStatsTables,
  WarmupConfig,
  WarmupContent,
  warmupContentsTables,
  warmupLogsTables,
  warmupStatsTables,
} from "@/db/schema";

const EVOLUTION_API_BASE_URL = process.env.EVOLUTION_API_BASE_URL;
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY;

interface SendMessageConfig {
  endpoint: string;
  payload: any;
  delay: number;
}

interface MessageDestination {
  isGroup: boolean;
  targets: string[];
}

interface ApiResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  status: string;
}

/**
 * Funções auxiliares para o serviço de aquecimento
 */
export class WarmupHelpers {
  /**
   * Inicializa estatísticas para uma instância
   */
  static async initializeStats(
    instanceId: string,
    userId: string,
    configId: string,
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Buscar ou criar estatísticas de mídia do dia atual (enviadas)
      const mediaStats = await db.query.mediaStatsTables.findFirst({
        where: and(
          eq(mediaStatsTables.instanceId, instanceId),
          eq(mediaStatsTables.userId, userId),
          gte(mediaStatsTables.date, today),
          lt(mediaStatsTables.date, tomorrow),
          eq(mediaStatsTables.isReceived, false),
        ),
      });

      if (!mediaStats) {
        await db.insert(mediaStatsTables).values({
          id: `${instanceId}_${userId}_sent_${Date.now()}`,
          instanceId,
          userId,
          date: today,
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
          createdAt: today,
          updatedAt: today,
        });
      }

      // Buscar ou criar estatísticas de recebimento
      const mediaReceivedStats = await db.query.mediaStatsTables.findFirst({
        where: and(
          eq(mediaStatsTables.instanceId, instanceId),
          eq(mediaStatsTables.userId, userId),
          gte(mediaStatsTables.date, today),
          lt(mediaStatsTables.date, tomorrow),
          eq(mediaStatsTables.isReceived, true),
        ),
      });

      if (!mediaReceivedStats) {
        await db.insert(mediaStatsTables).values({
          id: `${instanceId}_${userId}_received_${Date.now()}`,
          instanceId,
          userId,
          date: today,
          isReceived: true,
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
          createdAt: today,
          updatedAt: today,
        });
      }

      // Buscar ou criar estatísticas gerais de warmup
      const warmupStats = await db.query.warmupStatsTables.findFirst({
        where: and(
          eq(warmupStatsTables.instanceId, instanceId),
          eq(warmupStatsTables.userId, userId),
        ),
      });

      if (!warmupStats) {
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
          totalMessagesReceived: 0,
          dailyMessagesReceived: 0,
          totalErrors: 0,
          dailyErrors: 0,
          startedAt: new Date(),
          lastResetAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Atualizar estatísticas existentes
        await db
          .update(warmupStatsTables)
          .set({
            status: "active",
            isRunning: true,
            updatedAt: new Date(),
          })
          .where(eq(warmupStatsTables.id, warmupStats.id));
      }
    } catch (error) {
      console.error(
        `[initializeStats] Erro para instância ${instanceId}:`,
        error,
      );
    }
  }

  /**
   * Inicia o timer do worker
   */
  static async startWorkerTimer(
    instanceId: string,
  ): Promise<ReturnType<typeof setInterval>> {
    return setInterval(async () => {
      try {
        // Verificar se a instância ainda está ativa
        const stats = await db.query.warmupStatsTables.findFirst({
          where: eq(warmupStatsTables.instanceId, instanceId),
        });

        if (!stats || !stats.isRunning) {
          return;
        }

        // Atualizar timestamp de última atividade
        await db
          .update(warmupStatsTables)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(warmupStatsTables.instanceId, instanceId));
      } catch (error) {
        console.error(
          `[startWorkerTimer] Erro para instância ${instanceId}:`,
          error,
        );
      }
    }, 60 * 1000); // A cada minuto
  }

  /**
   * Atualiza estatísticas de mídia
   */
  static async updateMediaStats(
    instanceId: string,
    userId: string,
    messageType: string,
    isSent: boolean,
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Buscar estatísticas do dia atual
      const mediaStats = await db.query.mediaStatsTables.findFirst({
        where: and(
          eq(mediaStatsTables.instanceId, instanceId),
          eq(mediaStatsTables.userId, userId),
          gte(mediaStatsTables.date, today),
          lt(mediaStatsTables.date, tomorrow),
          eq(mediaStatsTables.isReceived, !isSent),
        ),
      });

      if (mediaStats) {
        const updateData: any = {
          updatedAt: new Date(),
        };

        // Incrementar contador específico do tipo
        switch (messageType) {
          case "text":
            updateData.textCount = mediaStats.textCount + 1;
            break;
          case "image":
            updateData.imageCount = mediaStats.imageCount + 1;
            break;
          case "video":
            updateData.videoCount = mediaStats.videoCount + 1;
            break;
          case "audio":
            updateData.audioCount = mediaStats.audioCount + 1;
            break;
          case "sticker":
            updateData.stickerCount = mediaStats.stickerCount + 1;
            break;
          case "button":
            updateData.buttonCount = mediaStats.buttonCount + 1;
            break;
          case "list":
            updateData.listCount = mediaStats.listCount + 1;
            break;
          case "reaction":
            updateData.reactionCount = mediaStats.reactionCount + 1;
            break;
        }

        updateData.totalDaily = mediaStats.totalDaily + 1;
        updateData.totalAllTime = mediaStats.totalAllTime + 1;

        await db
          .update(mediaStatsTables)
          .set(updateData)
          .where(eq(mediaStatsTables.id, mediaStats.id));
      }
    } catch (error) {
      console.error(
        `[updateMediaStats] Erro para instância ${instanceId}:`,
        error,
      );
    }
  }

  /**
   * Registra uma ação no log
   */
  static async logAction(
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
        configId: null, // Será preenchido pelo serviço principal
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

  /**
   * Obtém destinos para mensagens
   */
  static async getMessageDestinations(
    config: WarmupConfig,
  ): Promise<MessageDestination> {
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

  /**
   * Simula comportamento humano
   */
  static async simulateHumanBehavior(messageType: string): Promise<void> {
    // Delays baseados no tipo de mensagem
    const delays: { [key: string]: { min: number; max: number } } = {
      text: { min: 2, max: 8 },
      image: { min: 5, max: 15 },
      video: { min: 8, max: 20 },
      audio: { min: 3, max: 10 },
      sticker: { min: 1, max: 5 },
      reaction: { min: 1, max: 3 },
      reply: { min: 4, max: 12 },
    };

    const delay = delays[messageType] || delays.text;
    const randomDelay = Math.random() * (delay.max - delay.min) + delay.min;

    await new Promise((resolve) => setTimeout(resolve, randomDelay * 1000));
  }

  /**
   * Obtém conteúdo para um tipo específico
   */
  static async getContentForType(
    messageType: string,
    contents: WarmupContent[],
  ): Promise<WarmupContent | null> {
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

  /**
   * Envia uma mensagem via Evolution API
   */
  static async sendMessage(
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

  /**
   * Cria configuração de mensagem
   */
  static createMessageConfig(
    instanceId: string,
    formattedNumber: string,
    content: WarmupContent,
    messageType: string,
  ): SendMessageConfig {
    const baseEndpoint = `${EVOLUTION_API_BASE_URL}/message`;

    let endpoint = `${baseEndpoint}/sendText/${instanceId}`;
    let payload: any = {
      number: formattedNumber,
      textMessage: { text: content.content },
    };

    switch (messageType) {
      case "image":
        endpoint = `${baseEndpoint}/sendImage/${instanceId}`;
        payload = {
          number: formattedNumber,
          imageMessage: {
            image: content.content,
            caption: content.caption || "",
          },
        };
        break;

      case "video":
        endpoint = `${baseEndpoint}/sendVideo/${instanceId}`;
        payload = {
          number: formattedNumber,
          videoMessage: {
            video: content.content,
            caption: content.caption || "",
          },
        };
        break;

      case "audio":
        endpoint = `${baseEndpoint}/sendAudio/${instanceId}`;
        payload = {
          number: formattedNumber,
          audioMessage: {
            audio: content.content,
          },
        };
        break;

      case "sticker":
        endpoint = `${baseEndpoint}/sendSticker/${instanceId}`;
        payload = {
          number: formattedNumber,
          stickerMessage: {
            sticker: content.content,
          },
        };
        break;

      case "button":
        endpoint = `${baseEndpoint}/sendButton/${instanceId}`;
        payload = {
          number: formattedNumber,
          buttonMessage: {
            title: content.caption || "Opções",
            description: content.content,
            buttons: content.buttonText || [],
          },
        };
        break;

      case "list":
        endpoint = `${baseEndpoint}/sendList/${instanceId}`;
        payload = {
          number: formattedNumber,
          listMessage: {
            title: content.caption || "Lista",
            description: content.content,
            buttonText: "Ver opções",
            sections: content.listItems || [],
          },
        };
        break;
    }

    return {
      endpoint,
      payload,
      delay: Math.random() * 2 + 1, // Delay entre 1-3 segundos
    };
  }

  /**
   * Envia uma reação
   */
  static async sendReaction(
    instanceId: string,
    target: string,
    messageId: string,
    userId: string,
    emojis: string[] = ["👍", "❤️", "😂", "😮", "😢", "🙏"],
  ): Promise<boolean> {
    try {
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      const endpoint = `${EVOLUTION_API_BASE_URL}/reaction/send/${instanceId}`;
      const payload = {
        key: {
          remoteJid: target,
          fromMe: false,
          id: messageId,
        },
        text: randomEmoji,
      };

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
      console.error(`[sendReaction] Erro para instância ${instanceId}:`, error);
      return false;
    }
  }

  /**
   * Valida se um sticker é válido
   */
  static validateSticker(content: WarmupContent): boolean {
    if (content.type !== "sticker") return false;

    // Verificar se é uma URL válida ou base64
    if (content.content.startsWith("http")) {
      return true;
    }

    // Verificar se é base64 válido
    if (content.content.startsWith("data:image/")) {
      return true;
    }

    // Verificar se é base64 puro
    try {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      return base64Regex.test(content.content);
    } catch {
      return false;
    }
  }

  /**
   * Obtém o MIME type de um arquivo
   */
  static getMimeType(type: string): string {
    const mimeTypes: { [key: string]: string } = {
      image: "image/jpeg",
      video: "video/mp4",
      audio: "audio/mp3",
      sticker: "image/webp",
      document: "application/pdf",
    };

    return mimeTypes[type] || "application/octet-stream";
  }

  /**
   * Seleciona um item aleatório de uma lista
   */
  static getRandomItem<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("Lista vazia");
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Aguarda um tempo aleatório
   */
  static async delay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  }

  /**
   * Processa uma mensagem recebida
   */
  static async processReceivedMessage(
    instanceId: string,
    userId: string,
    message: any,
  ): Promise<void> {
    try {
      const messageType = this.getMessageTypeFromMessage(message);

      // Atualizar estatísticas de recebimento
      await this.updateMediaStats(instanceId, userId, messageType, false);

      // Log da mensagem recebida
      await this.logAction(
        instanceId,
        userId,
        "message_received",
        messageType,
        message.key?.remoteJid || null,
        true,
        "Mensagem recebida automaticamente",
      );
    } catch (error) {
      console.error(
        `[processReceivedMessage] Erro para instância ${instanceId}:`,
        error,
      );
    }
  }

  /**
   * Determina o tipo de mensagem
   */
  static getMessageTypeFromMessage(message: any): string {
    if (message.message?.conversation || message.message?.extendedTextMessage) {
      return "text";
    }

    if (message.message?.imageMessage) return "image";
    if (message.message?.videoMessage) return "video";
    if (message.message?.audioMessage) return "audio";
    if (message.message?.stickerMessage) return "sticker";
    if (message.message?.buttonsMessage) return "button";
    if (message.message?.listMessage) return "list";
    if (message.message?.reactionMessage) return "reaction";

    return "unknown";
  }

  /**
   * Reseta contadores diários
   */
  static async resetDailyCounters(instanceId: string): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Resetar contadores diários de estatísticas
      await db
        .update(warmupStatsTables)
        .set({
          dailyMessagesSent: 0,
          dailyMessagesReceived: 0,
          dailyErrors: 0,
          updatedAt: new Date(),
        })
        .where(eq(warmupStatsTables.instanceId, instanceId));

      // Resetar contadores diários de conteúdo
      await db
        .update(warmupContentsTables)
        .set({
          currentDailyUsage: 0,
          updatedAt: new Date(),
        })
        .where(
          eq(
            warmupContentsTables.configId,
            (
              await db.query.warmupStatsTables.findFirst({
                where: eq(warmupStatsTables.instanceId, instanceId),
              })
            )?.configId || "",
          ),
        );

      // Resetar contadores diários de mídia
      await db
        .update(mediaStatsTables)
        .set({
          totalDaily: 0,
          updatedAt: new Date(),
        })
        .where(eq(mediaStatsTables.instanceId, instanceId));

      console.log(
        `[resetDailyCounters] Contadores diários resetados para instância ${instanceId}`,
      );
    } catch (error) {
      console.error(
        `[resetDailyCounters] Erro para instância ${instanceId}:`,
        error,
      );
    }
  }
}
