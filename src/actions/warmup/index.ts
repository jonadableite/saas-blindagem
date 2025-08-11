// src/actions/warmup/index.ts
"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { instancesTables, usersTables } from "@/db/schema";
import {
  CreateWarmupConfigSchema,
  mediaStatsTables,
  NewWarmupConfig,
  NewWarmupContent,
  StartWarmupSchema,
  UpdateWarmupConfigSchema,
  warmupConfigsTables,
  WarmupContentSchema,
  warmupContentsTables,
  warmupLogsTables,
  warmupStatsTables,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { warmupService } from "@/lib/services/warmup-service";

/**
 * Cria uma nova configuração de aquecimento
 */
export async function createWarmupConfig(
  input: z.infer<typeof CreateWarmupConfigSchema>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const validationResult = CreateWarmupConfigSchema.safeParse(input);

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    const configData: NewWarmupConfig = {
      ...validationResult.data,
      userId,
    };

    const [config] = await db
      .insert(warmupConfigsTables)
      .values(configData)
      .returning();

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Configuração de aquecimento criada com sucesso!",
      config,
    };
  } catch (error) {
    console.error("[createWarmupConfig] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Atualiza uma configuração de aquecimento
 */
export async function updateWarmupConfig(
  configId: string,
  input: z.infer<typeof UpdateWarmupConfigSchema>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const validationResult = UpdateWarmupConfigSchema.safeParse(input);

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Verificar se a configuração pertence ao usuário
    const existingConfig = await db.query.warmupConfigsTables.findFirst({
      where: and(
        eq(warmupConfigsTables.id, configId),
        eq(warmupConfigsTables.userId, userId),
      ),
    });

    if (!existingConfig) {
      return {
        success: false,
        error: "Configuração não encontrada",
      };
    }

    const [updatedConfig] = await db
      .update(warmupConfigsTables)
      .set({
        ...validationResult.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warmupConfigsTables.id, configId),
          eq(warmupConfigsTables.userId, userId),
        ),
      )
      .returning();

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Configuração atualizada com sucesso!",
      config: updatedConfig,
    };
  } catch (error) {
    console.error("[updateWarmupConfig] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Busca todas as configurações do usuário
 */
export async function getUserWarmupConfigs() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const configs = await db.query.warmupConfigsTables.findMany({
      where: eq(warmupConfigsTables.userId, userId),
      with: {
        contents: {
          where: eq(warmupContentsTables.isActive, true),
        },
      },
      orderBy: desc(warmupConfigsTables.createdAt),
    });

    return {
      success: true,
      configs,
    };
  } catch (error) {
    console.error("[getUserWarmupConfigs] Erro:", error);
    return {
      success: false,
      error: "Erro ao buscar configurações",
      configs: [],
    };
  }
}

/**
 * Adiciona conteúdo a uma configuração
 */
export async function addWarmupContent(
  configId: string,
  input: z.infer<typeof WarmupContentSchema>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const validationResult = WarmupContentSchema.safeParse(input);

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Verificar se a configuração pertence ao usuário
    const config = await db.query.warmupConfigsTables.findFirst({
      where: and(
        eq(warmupConfigsTables.id, configId),
        eq(warmupConfigsTables.userId, userId),
      ),
    });

    if (!config) {
      return {
        success: false,
        error: "Configuração não encontrada",
      };
    }

    const contentData: NewWarmupContent = {
      ...validationResult.data,
      userId,
      configId,
    };

    const [content] = await db
      .insert(warmupContentsTables)
      .values(contentData)
      .returning();

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Conteúdo adicionado com sucesso!",
      content,
    };
  } catch (error) {
    console.error("[addWarmupContent] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Remove um conteúdo
 */
export async function removeWarmupContent(contentId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    // Verificar se o conteúdo pertence ao usuário
    const content = await db.query.warmupContentsTables.findFirst({
      where: and(
        eq(warmupContentsTables.id, contentId),
        eq(warmupContentsTables.userId, userId),
      ),
    });

    if (!content) {
      return {
        success: false,
        error: "Conteúdo não encontrado",
      };
    }

    await db
      .update(warmupContentsTables)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(warmupContentsTables.id, contentId),
          eq(warmupContentsTables.userId, userId),
        ),
      );

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Conteúdo removido com sucesso!",
    };
  } catch (error) {
    console.error("[removeWarmupContent] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Inicia o aquecimento
 */
export async function startWarmup(input: z.infer<typeof StartWarmupSchema>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const validationResult = StartWarmupSchema.safeParse(input);

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { instanceIds, configId } = validationResult.data;

    // Verificar se as instâncias pertencem ao usuário
    const userInstances = await db.query.instancesTables.findMany({
      where: and(
        eq(instancesTables.userId, userId),
        eq(instancesTables.isActive, true),
      ),
    });

    const validInstanceIds = userInstances.map((i) => i.instanceId);
    const filteredInstanceIds = instanceIds.filter((id) =>
      validInstanceIds.includes(id),
    );

    if (filteredInstanceIds.length === 0) {
      return {
        success: false,
        error: "Nenhuma instância válida selecionada",
      };
    }

    // Verificar se a configuração pertence ao usuário
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
        error: "Configuração não encontrada ou inativa",
      };
    }

    // Iniciar aquecimento através do serviço
    const result = await warmupService.startWarmup(
      userId,
      configId,
      filteredInstanceIds,
    );

    revalidatePath("/whatsapp/aquecimento");

    return result;
  } catch (error) {
    console.error("[startWarmup] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Para o aquecimento
 */
export async function stopWarmup(instanceIds: string[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const result = await warmupService.stopWarmup(userId, instanceIds);

    revalidatePath("/whatsapp/aquecimento");

    return result;
  } catch (error) {
    console.error("[stopWarmup] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Para todos os aquecimentos do usuário
 */
export async function stopAllWarmup() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    await warmupService.stopAllUserWarmup(userId);

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Todos os aquecimentos foram parados",
    };
  } catch (error) {
    console.error("[stopAllWarmup] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

/**
 * Busca estatísticas de uma instância
 */
export async function getInstanceWarmupStats(instanceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    // Verificar se a instância pertence ao usuário
    const instance = await db.query.instancesTables.findFirst({
      where: and(
        eq(instancesTables.instanceId, instanceId),
        eq(instancesTables.userId, userId),
      ),
    });

    if (!instance) {
      return {
        success: false,
        error: "Instância não encontrada",
      };
    }

    const stats = await warmupService.getInstanceStats(instanceId, userId);

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("[getInstanceWarmupStats] Erro:", error);
    return {
      success: false,
      error: "Erro ao buscar estatísticas",
    };
  }
}

/**
 * Busca logs de aquecimento
 */
export async function getWarmupLogs(instanceId?: string, limit = 50) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    let whereClause = eq(warmupLogsTables.userId, userId);

    if (instanceId) {
      // Verificar se a instância pertence ao usuário
      const instance = await db.query.instancesTables.findFirst({
        where: and(
          eq(instancesTables.instanceId, instanceId),
          eq(instancesTables.userId, userId),
        ),
      });

      if (!instance) {
        return {
          success: false,
          error: "Instância não encontrada",
          logs: [],
        };
      }

      whereClause = and(
        whereClause,
        eq(warmupLogsTables.instanceId, instanceId),
      );
    }

    const logs = await db.query.warmupLogsTables.findMany({
      where: whereClause,
      orderBy: desc(warmupLogsTables.createdAt),
      limit,
      with: {
        instance: {
          columns: {
            instanceName: true,
            profileName: true,
          },
        },
      },
    });

    return {
      success: true,
      logs,
    };
  } catch (error) {
    console.error("[getWarmupLogs] Erro:", error);
    return {
      success: false,
      error: "Erro ao buscar logs",
      logs: [],
    };
  }
}

/**
 * Busca status geral do serviço de aquecimento
 */
export async function getWarmupServiceStats() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    const serviceStats = warmupService.getServiceStats();

    // Filtrar apenas as instâncias do usuário
    const userStats = {
      ...serviceStats,
      workers: serviceStats.workers.filter((w) => w.userId === userId),
    };

    userStats.totalWorkers = userStats.workers.length;
    userStats.activeWorkers = userStats.workers.filter(
      (w) => w.isRunning,
    ).length;
    userStats.errorWorkers = userStats.workers.filter(
      (w) => w.errorCount > 0,
    ).length;

    return {
      success: true,
      stats: userStats,
    };
  } catch (error) {
    console.error("[getWarmupServiceStats] Erro:", error);
    return {
      success: false,
      error: "Erro ao buscar estatísticas do serviço",
    };
  }
}

/**
 * Delete uma configuração de aquecimento
 */
export async function deleteWarmupConfig(configId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    // Verificar se a configuração pertence ao usuário
    const config = await db.query.warmupConfigsTables.findFirst({
      where: and(
        eq(warmupConfigsTables.id, configId),
        eq(warmupConfigsTables.userId, userId),
      ),
    });

    if (!config) {
      return {
        success: false,
        error: "Configuração não encontrada",
      };
    }

    // Parar todos os aquecimentos que usam esta configuração
    const activeStats = await db.query.warmupStatsTables.findMany({
      where: and(
        eq(warmupStatsTables.configId, configId),
        eq(warmupStatsTables.status, "active"),
      ),
    });

    if (activeStats.length > 0) {
      const instanceIds = activeStats.map((s) => s.instanceId);
      await warmupService.stopWarmup(userId, instanceIds);
    }

    // Marcar como inativa (soft delete)
    await db
      .update(warmupConfigsTables)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(warmupConfigsTables.id, configId),
          eq(warmupConfigsTables.userId, userId),
        ),
      );

    revalidatePath("/whatsapp/aquecimento");

    return {
      success: true,
      message: "Configuração removida com sucesso!",
    };
  } catch (error) {
    console.error("[deleteWarmupConfig] Erro:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}
