// src/app/(protected)/whatsapp/components/whatsapp-client-page.tsx
"use client";

import { Loader2, Lock, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createInstance } from "@/actions/instance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreateInstanceSchema, Instance } from "@/db/schema";
import { InstanceList } from "./instance-list";

interface WhatsappClientPageProps {
  initialInstances: Instance[];
  userPlan: string; // Propriedade para o nome do plano
  instanceLimit: number; // Propriedade para o limite de instâncias
  currentInstancesCount: number; // Propriedade para a contagem atual de instâncias
  // trialEndDate?: Date | null; // Adicione se você tiver campo de data de fim de teste
}

export function WhatsappClientPage({
  initialInstances,
  userPlan,
  instanceLimit,
  currentInstancesCount,
  // trialEndDate,
}: WhatsappClientPageProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  const handleCreateInstance = async () => {
    // Verificação de limite antes de tentar criar a instância
    if (currentInstancesCount >= instanceLimit) {
      toast.error(`Você atingiu o limite de ${instanceLimit} instância(s) para o seu plano.`);
      setIsModalOpen(false); // Fecha o modal se o limite for atingido
      return;
    }

    try {
      setIsCreatingInstance(true);

      const validatedFields = CreateInstanceSchema.safeParse({
        instanceName,
        webhookUrl: webhookEnabled ? webhookUrl : undefined,
        webhookEnabled,
      });

      if (!validatedFields.success) {
        validatedFields.error.errors.forEach((err) => {
          toast.error(err.message);
        });
        return;
      }

      const newInstance = await createInstance(validatedFields.data);

      if (newInstance) {
        setInstances((prev) => [...prev, newInstance]);
        toast.success("Instância criada com sucesso!");
        setInstanceName("");
        setWebhookUrl("");
        setWebhookEnabled(false);
        setIsModalOpen(false);
      } else {
        toast.error("Erro ao criar instância. Tente novamente.");
      }
    } catch (error) {
      console.error("Failed to create instance:", error);
      toast.error("Erro ao criar instância. Verifique o console.");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  // Lógica para desabilitar o botão de criação de instância
  const isCreateButtonDisabled = currentInstancesCount >= instanceLimit || isCreatingInstance;
  const instancesPercentage = instanceLimit > 0 ? (currentInstancesCount / instanceLimit) * 100 : 0;

  return (
    <div className="flex flex-col flex-grow p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Minhas Instâncias</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                if (currentInstancesCount >= instanceLimit) {
                  toast.error(`Você atingiu o limite de ${instanceLimit} instância(s) para o seu plano.`);
                } else {
                  setIsModalOpen(true);
                }
              }}
              disabled={isCreateButtonDisabled}
              className={`
                font-semibold py-2 px-6 rounded-lg shadow-md hover:shadow-lg
                transition-opacity duration-300
                flex items-center justify-center
                ${isCreateButtonDisabled
                  ? 'bg-electric cursor-not-allowed opacity-90'
                  : isCreatingInstance
                    ? 'bg-yellow-600 cursor-wait opacity-70'
                    : 'bg-gradient-to-r from-electric to-blue-600 hover:opacity-90'
                }
              `}
            >
              {isCreatingInstance ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Criando...
                </>
              ) : currentInstancesCount >= instanceLimit ? (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Limite Atingido ({instanceLimit})
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Nova Instância
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card text-foreground border-border">
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
              <DialogDescription>
                Preencha os detalhes para criar uma nova instância de WhatsApp.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="instanceName" className="text-right">
                  Nome
                </Label>
                <Input
                  id="instanceName"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="col-span-3 bg-input text-foreground"
                  placeholder="Minha Instância de Vendas"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="webhookUrl" className="text-right">
                  Webhook URL
                </Label>
                <Input
                  id="webhookUrl"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="col-span-3 bg-input text-foreground"
                  placeholder="https://seuservidor.com/webhook"
                  disabled={!webhookEnabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="webhookEnabled" className="text-right">
                  Ativar Webhook
                </Label>
                <Switch
                  id="webhookEnabled"
                  checked={webhookEnabled}
                  onCheckedChange={setWebhookEnabled}
                  className="col-span-3"
                />
              </div>
            </div>
            <Button onClick={handleCreateInstance} disabled={isCreatingInstance}>
              {isCreatingInstance ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Instância"
              )}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bloco de Métricas - Refatorado */}
      <div className="flex items-center gap-4 bg-deep/60 backdrop-blur-xl px-6 py-3 rounded-xl border border-electric/40 shadow-lg flex-wrap mx-auto w-fit">
        {/* Métrica: Instâncias */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-300">Instâncias:</span>
          <span className="text-base font-semibold text-neon-green">
            {currentInstancesCount} / {instanceLimit}
          </span>
          {/* Opcional: Porcentagem de instâncias */}
          {instanceLimit > 0 && (
            <span className={`font-semibold text-sm ${instancesPercentage > 80 ? 'text-red-500' : ''}`}>
              ({instancesPercentage.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>


      <InstanceList initialInstances={instances} />
    </div>
  );
}
