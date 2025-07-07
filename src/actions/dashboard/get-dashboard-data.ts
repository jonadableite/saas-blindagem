// src/actions/dashboard/get-dashboard-data.ts
"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { instancesTables } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getDashboardData() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  try {
    // Buscar todas as instâncias do usuário
    const instances = await db
      .select()
      .from(instancesTables)
      .where(eq(instancesTables.userId, userId));

    // Calcular métricas básicas
    const totalInstances = instances.length;
    const activeInstances = instances.filter(
      (instance) => instance.status === "open" || instance.status === "online",
    ).length;
    const connectingInstances = instances.filter(
      (instance) =>
        instance.status === "connecting" ||
        instance.status === "qrcode" ||
        instance.status === "start",
    ).length;
    const offlineInstances = instances.filter(
      (instance) =>
        instance.status === "close" || instance.status === "offline",
    ).length;

    // Dados simulados para demonstração (substituir por dados reais posteriormente)
    const mockData = {
      totalMessages: 1250,
      messagesGrowth: 12.5,
      deliveryRate: 94.2,
      deliveryGrowth: 2.1,
      campaignsActive: 3,
      campaignsGrowth: 0,
      contactsReached: 892,
      contactsGrowth: 8.7,
    };

    // Dados para gráficos (mock data)
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split("T")[0],
        messages: Math.floor(Math.random() * 200) + 50,
        delivered: Math.floor(Math.random() * 180) + 40,
        failed: Math.floor(Math.random() * 20) + 5,
      };
    });

    // Atividades recentes (mock data)
    const recentActivities = [
      {
        id: 1,
        type: "message",
        title: "Campanha 'Black Friday' enviada",
        description: "150 mensagens enviadas com sucesso",
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        status: "success",
      },
      {
        id: 2,
        type: "instance",
        title: "Instância 'Vendas' conectada",
        description: "Conectado com sucesso ao WhatsApp",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        status: "success",
      },
      {
        id: 3,
        type: "warning",
        title: "Limite de mensagens atingido",
        description: "Instância 'Suporte' pausada temporariamente",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
        status: "warning",
      },
      {
        id: 4,
        type: "campaign",
        title: "Nova campanha criada",
        description: "Campanha 'Newsletter Semanal' programada",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6h ago
        status: "info",
      },
    ];

    return {
      success: true,
      data: {
        instances: {
          total: totalInstances,
          active: activeInstances,
          connecting: connectingInstances,
          offline: offlineInstances,
        },
        metrics: mockData,
        chartData,
        recentActivities,
        instancesList: instances.slice(0, 5), // Top 5 instances
      },
    };
  } catch (error) {
    console.error("[getDashboardData] Erro:", error);
    return {
      success: false,
      error: "Erro ao buscar dados do dashboard",
    };
  }
}
