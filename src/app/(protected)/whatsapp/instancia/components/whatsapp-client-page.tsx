// src/app/(protected)/whatsapp/components/whatsapp-client-page.tsx
"use client";

import { Loader2, Lock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
  userPlan: string;
  instanceLimit: number;
  currentInstancesCount: number;
}

// Componente para exibir QR Code e atualizar em loop rápido
function QrCodeViewer({
  instanceName,
  open,
  onClose,
}: {
  instanceName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !instanceName) return;
    setQrCode(null);

    // Consulta a cada 1.2 segundos até achar QR
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/instance/${instanceName}/qrcode`);
        const data = await res.json();
        if (data?.base64) {
          setQrCode(data.base64);
          clearInterval(interval);
        }
      } catch {
        // ignora erros até carregar
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [open, instanceName]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle>Escaneie o QR Code</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp e conecte sua conta.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center p-4">
          {qrCode ? (
            <img
              src={`data:image/png;base64,${qrCode}`}
              alt="QR Code"
              className="rounded-lg shadow"
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsappClientPage({
  initialInstances,
  userPlan,
  instanceLimit,
  currentInstancesCount,
}: WhatsappClientPageProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  // Controle do modal QR rápido
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");

  const handleCreateInstance = async () => {
    if (currentInstancesCount >= instanceLimit) {
      toast.error(`Você atingiu o limite de ${instanceLimit} instância(s).`);
      setIsModalOpen(false);
      return;
    }

    const validated = CreateInstanceSchema.safeParse({ instanceName });
    if (!validated.success) {
      validated.error.errors.forEach((err) => toast.error(err.message));
      return;
    }

    try {
      setIsCreatingInstance(true);

      // Abrimos o modal do QR imediatamente
      setQrInstanceName(instanceName);
      setQrModalOpen(true);
      setIsModalOpen(false);

      // Criar a instância
      const newInstanceResponse = await createInstance(validated.data);

      let instanceToAdd: Instance | undefined;
      if (
        typeof newInstanceResponse === "object" &&
        newInstanceResponse !== null
      ) {
        if ("instance" in newInstanceResponse && newInstanceResponse.instance) {
          instanceToAdd = newInstanceResponse.instance as Instance;
        } else if (!("error" in newInstanceResponse)) {
          instanceToAdd = newInstanceResponse as unknown as Instance;
        }
      }

      if (instanceToAdd) {
        setInstances((prev) => [...prev, instanceToAdd]);
        toast.success("Instância criada, conectando...");
        setInstanceName("");
        setWebhookUrl("");
        setWebhookEnabled(false);
      } else {
        toast.error("Erro ao criar instância. Verifique os dados.");
        setQrModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to create instance:", err);
      toast.error("Erro ao criar instância.");
      setQrModalOpen(false);
    } finally {
      setIsCreatingInstance(false);
    }
  };

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
              onClick={() =>
                currentInstancesCount < instanceLimit
                  ? setIsModalOpen(true)
                  : toast.error(
                      `Limite de ${instanceLimit} instâncias atingido.`,
                    )
              }
              disabled={isCreateButtonDisabled}
              className="flex items-center justify-center rounded-lg px-6 py-2 font-semibold shadow-md"
            >
              {isCreatingInstance ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Criando...
                </>
              ) : currentInstancesCount >= instanceLimit ? (
                <>
                  <Lock className="mr-2 h-5 w-5" /> Limite Atingido (
                  {instanceLimit})
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-5 w-5" /> Nova Instância
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
              <DialogDescription>
                Preencha os detalhes abaixo.
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
                  className="col-span-3"
                  placeholder="Minha Instância"
                />
              </div>
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
                    type="url"
                    className="col-span-3"
                    placeholder="https://sua-api.com/webhook"
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                "Criar Instância"
              )}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Métricas */}
      <div className="bg-deep/60 border-electric/40 mx-auto flex w-fit items-center gap-4 rounded-xl border px-6 py-3 shadow-lg">
        <span className="text-sm text-gray-300">Instâncias:</span>
        <span className="text-neon-green font-semibold">
          {currentInstancesCount} / {instanceLimit}
        </span>
        {instanceLimit > 0 && (
          <span
            className={`text-sm font-semibold ${instancesPercentage > 80 ? "text-red-500" : ""}`}
          >
            ({instancesPercentage.toFixed(2)}%)
          </span>
        )}
      </div>

      <InstanceList initialInstances={instances} />

      {/* Modal de QR rápido */}
      {qrInstanceName && (
        <QrCodeViewer
          instanceName={qrInstanceName}
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
        />
      )}
    </div>
  );
}
