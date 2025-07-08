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
import { Switch } from "@/components/ui/switch"; // Certifique-se de importar Switch
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
      toast.error(
        `Você atingiu o limite de ${instanceLimit} instância(s) para o seu plano.`,
      );
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

      const newInstanceResponse = await createInstance(validatedFields.data); // Renomeado para clareza

      let instanceToAdd: Instance | undefined;

      // Verifica se a resposta é um objeto e contém a propriedade 'instance'
      if (
        typeof newInstanceResponse === "object" &&
        newInstanceResponse !== null &&
        "instance" in newInstanceResponse &&
        newInstanceResponse.instance
      ) {
        // Se sim, a instância está aninhada na propriedade 'instance'
        instanceToAdd = newInstanceResponse.instance as Instance;
      } else if (
        typeof newInstanceResponse === "object" &&
        newInstanceResponse !== null &&
        !("error" in newInstanceResponse)
      ) {
        // Se não tem 'instance' nem 'error', assume que a própria resposta é a instância
        // Isso cobre o caso em que 'createInstance' retorna a Instance diretamente
        instanceToAdd = newInstanceResponse as unknown as Instance;
      }

      if (instanceToAdd) {
        setInstances((prev) => [...prev, instanceToAdd]);
        toast.success("Instância criada com sucesso!");
        setInstanceName("");
        setWebhookUrl("");
        setWebhookEnabled(false);
        setIsModalOpen(false);
      } else {
        // Lida com os casos de erro
        let errorMessage = "Erro ao criar instância. Tente novamente.";
        if (
          typeof newInstanceResponse === "object" &&
          newInstanceResponse !== null &&
          "error" in newInstanceResponse
        ) {
          if (typeof newInstanceResponse.error === "string") {
            errorMessage = newInstanceResponse.error;
          } else if (
            newInstanceResponse.error &&
            typeof newInstanceResponse.error.message === "string"
          ) {
            errorMessage = newInstanceResponse.error.message;
          }
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to create instance:", error);
      toast.error("Erro ao criar instância. Verifique o console.");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  // Lógica para desabilitar o botão de criação de instância
  const isCreateButtonDisabled =
    currentInstancesCount >= instanceLimit || isCreatingInstance;
  const instancesPercentage =
    instanceLimit > 0 ? (currentInstancesCount / instanceLimit) * 100 : 0;

  return (
    <div className="flex flex-grow flex-col space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-3xl font-bold">
          Minhas Instâncias
        </h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                if (currentInstancesCount >= instanceLimit) {
                  toast.error(
                    `Você atingiu o limite de ${instanceLimit} instância(s) para o seu plano.`,
                  );
                } else {
                  setIsModalOpen(true);
                }
              }}
              disabled={isCreateButtonDisabled}
              className={`flex items-center justify-center rounded-lg px-6 py-2 font-semibold shadow-md transition-opacity duration-300 hover:shadow-lg ${
                isCreateButtonDisabled
                  ? "bg-electric cursor-not-allowed opacity-90"
                  : isCreatingInstance
                    ? "cursor-wait bg-yellow-600 opacity-70"
                    : "from-electric bg-gradient-to-r to-blue-600 hover:opacity-90"
              } `}
            >
              {isCreatingInstance ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando...
                </>
              ) : currentInstancesCount >= instanceLimit ? (
                <>
                  <Lock className="mr-2 h-5 w-5" />
                  Limite Atingido ({instanceLimit})
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-5 w-5" />
                  Nova Instância
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-[425px]">
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
                  className="bg-input text-foreground col-span-3"
                  placeholder="Minha Instância de Vendas"
                />
              </div>
              {/* Webhook Fields */}
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="webhookEnabled" className="flex-1">
                  Ativar Webhook
                </Label>
                <Switch
                  id="webhookEnabled"
                  checked={webhookEnabled}
                  onCheckedChange={setWebhookEnabled}
                />
              </div>
              {webhookEnabled && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="webhookUrl" className="text-right">
                    URL Webhook
                  </Label>
                  <Input
                    id="webhookUrl"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="col-span-3"
                    placeholder="https://sua-api.com/webhook"
                    type="url"
                  />
                </div>
              )}
            </div>
            <Button
              onClick={handleCreateInstance}
              disabled={isCreatingInstance}
            >
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
      <div className="bg-deep/60 border-electric/40 mx-auto flex w-fit flex-wrap items-center gap-4 rounded-xl border px-6 py-3 shadow-lg backdrop-blur-xl">
        {/* Métrica: Instâncias */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-300">Instâncias:</span>
          <span className="text-neon-green text-base font-semibold">
            {currentInstancesCount} / {instanceLimit}
          </span>
          {/* Opcional: Porcentagem de instâncias */}
          {instanceLimit > 0 && (
            <span
              className={`text-sm font-semibold ${instancesPercentage > 80 ? "text-red-500" : ""}`}
            >
              ({instancesPercentage.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      <InstanceList initialInstances={instances} />
    </div>
  );
}
