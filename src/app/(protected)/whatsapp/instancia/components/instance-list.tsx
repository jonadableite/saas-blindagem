// src/app/(protected)/whatsapp/components/instance-list.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, // Para StatusBadge
  AlertCircle, // Para StatusBadge
  Globe,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCcw,
  Search,
  Settings,
  Trash2,
  Wifi, // Para StatusBadge
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deleteInstance,
  fetchInstanceDetails,
  getInstanceQrCode,
  logoutInstance,
  restartInstance,
} from "@/actions/instance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { instancesTables } from "@/db/schema";
import { cn } from "@/lib/utils";

import { InstanceProxyModal } from "./instance-proxy-modal";
import { InstanceSettingsModal } from "./instance-settings-modal";
import { TooltipActionButton } from "./tooltip-action-button";

export type Instance = typeof instancesTables.$inferSelect;

interface InstanceListProps {
  initialInstances: Instance[];
}

// Componente de status elegante (descomentado e melhorado)
const StatusBadge = ({ status }: { status: string | null }) => {
  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "open":
      case "online":
        return {
          icon: Wifi,
          variant: "default" as const,
          className:
            "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
          text: "Online",
          pulse: true,
        };
      case "connecting":
      case "start":
        return {
          icon: Activity,
          variant: "secondary" as const,
          className:
            "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
          text: "Conectando",
          pulse: true,
        };
      case "qrcode":
        return {
          icon: QrCode,
          variant: "secondary" as const,
          className:
            "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
          text: "QR Code",
          pulse: true,
        };
      case "close":
      case "offline":
        return {
          icon: WifiOff,
          variant: "secondary" as const,
          className:
            "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
          text: "Offline",
          pulse: false,
        };
      default:
        return {
          icon: AlertCircle,
          variant: "secondary" as const,
          className:
            "bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400",
          text: "Desconhecido",
          pulse: false,
        };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn("flex items-center gap-1.5 px-2 py-1", config.className)}
    >
      <motion.div
        animate={config.pulse ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <IconComponent className="h-3 w-3" />
      </motion.div>
      <span className="text-xs font-medium">{config.text}</span>
    </Badge>
  );
};

// Avatar com indicador de status
const InstanceAvatar = ({ instance }: { instance: Instance }) => {
  const isOnline = instance.status === "open" || instance.status === "online";

  return (
    <div className="relative">
      <Avatar className="border-border h-12 w-12 border-2 shadow-sm md:h-14 md:w-14">
        <AvatarImage
          src={instance.profilePicUrl || undefined}
          alt={instance.profileName || instance.instanceName}
          className="object-cover"
        />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {instance.profileName ? (
            instance.profileName.charAt(0).toUpperCase()
          ) : instance.instanceName ? (
            instance.instanceName.charAt(0).toUpperCase()
          ) : (
            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* Indicador de status */}
      <motion.div
        className={cn(
          "border-background absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2",
          isOnline ? "bg-emerald-500" : "bg-gray-400",
        )}
        animate={isOnline ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
};

export function InstanceList({ initialInstances }: InstanceListProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [currentQrCodeData, setCurrentQrCodeData] = useState<{
    base64?: string;
    pairingCode?: string;
  } | null>(null);
  const [loadingQrCode, setLoadingQrCode] = useState(false);

  // Estado para o modal de configurações
  const [settingsModal, setSettingsModal] = useState<{
    isOpen: boolean;
    instanceName: string;
  }>({
    isOpen: false,
    instanceName: "",
  });

  // Estado para o modal de proxy
  const [proxyModal, setProxyModal] = useState<{
    isOpen: boolean;
    instanceName: string;
  }>({
    isOpen: false,
    instanceName: "",
  });

  const instancesRef = useRef(instances);

  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  const fetchCompleteInstanceDetails = useCallback(
    async (instanceName: string) => {
      setLoadingStatus((prev) => ({ ...prev, [instanceName]: true }));
      const result = await fetchInstanceDetails({ instanceName });
      setLoadingStatus((prev) => ({ ...prev, [instanceName]: false }));

      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.instanceName === instanceName) {
            if ("success" in result && result.success && result.instance) {
              return result.instance;
            } else if ("error" in result && result.error) {
              toast.error(
                `Erro ao obter detalhes de ${instanceName}: ${result.error}`,
              );
              return inst;
            }
          }
          return inst;
        }),
      );
    },
    [],
  );

  const handleOpenQrModal = useCallback(async (instanceName: string) => {
    setLoadingQrCode(true);
    setIsQrModalOpen(true);
    setCurrentQrCodeData(null);

    const result = await getInstanceQrCode({ instanceName });

    if (result.success) {
      setCurrentQrCodeData({
        base64: result.qrCode,
        pairingCode: result.pairingCode,
      });
    } else {
      toast.error(result.error || "Erro ao carregar QR Code.");
      setIsQrModalOpen(false);
    }
    setLoadingQrCode(false);
  }, []);

  const handleCloseQrModal = useCallback(() => {
    setIsQrModalOpen(false);
    setCurrentQrCodeData(null);
  }, []);

  // Funções para o modal de configurações
  const handleOpenSettings = useCallback((instanceName: string) => {
    setSettingsModal({
      isOpen: true,
      instanceName,
    });
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsModal({
      isOpen: false,
      instanceName: "",
    });
  }, []);

  // Funções para o modal de proxy
  const handleOpenProxyModal = useCallback((instanceName: string) => {
    setProxyModal({
      isOpen: true,
      instanceName,
    });
  }, []);

  const handleCloseProxyModal = useCallback(() => {
    setProxyModal({
      isOpen: false,
      instanceName: "",
    });
  }, []);

  const handleProxySetSuccess = useCallback(
    (instanceName: string) => {
      // Opcionalmente, atualize os detalhes da instância se o status do proxy afetar o cartão principal
      // fetchCompleteInstanceDetails(instanceName);
      toast.success(`Proxy para ${instanceName} configurado com sucesso!`);
      handleCloseProxyModal();
    },
    [handleCloseProxyModal],
  );

  useEffect(() => {
    if (!hasInitialized && initialInstances.length > 0) {
      setHasInitialized(true);
      initialInstances.forEach((instance) => {
        fetchCompleteInstanceDetails(instance.instanceName);
      });
    }
  }, [initialInstances, hasInitialized, fetchCompleteInstanceDetails]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      instancesRef.current.forEach((instance) => {
        if (
          instance.status === "connecting" ||
          instance.status === "qrcode" ||
          instance.status === "start" ||
          instance.status === "unknown"
        ) {
          fetchCompleteInstanceDetails(instance.instanceName);
        }
      });
    }, 90000); // Consulta a cada 90 segundos

    return () => clearInterval(intervalId);
  }, [fetchCompleteInstanceDetails]);

  const filteredInstances = instances.filter(
    (instance) =>
      instance.instanceName.toLowerCase().includes(search.toLowerCase()) ||
      instance.profileName?.toLowerCase().includes(search.toLowerCase()) ||
      (instance.ownerJid &&
        instance.ownerJid
          .replace("@s.whatsapp.net", "")
          .includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Barra de busca */}
      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar instâncias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid de instâncias */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredInstances.length === 0 ? (
            <motion.div
              key="no-instances"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="bg-muted mb-4 rounded-full p-4">
                <Search className="text-muted-foreground h-8 w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {instances.length === 0
                  ? "Nenhuma instância encontrada"
                  : "Nenhum resultado"}
              </h3>
              <p className="text-muted-foreground">
                {instances.length === 0
                  ? "Crie uma nova instância para começar"
                  : "Tente ajustar seu termo de busca"}
              </p>
            </motion.div>
          ) : (
            filteredInstances.map((instance, index) => (
              <motion.div
                key={instance.instanceId}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
              >
                <Card className="group h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <InstanceAvatar instance={instance} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">
                            {instance.instanceName}
                          </CardTitle>
                          {instance.profileName && (
                            <p className="text-muted-foreground mt-0.5 truncate text-sm">
                              {instance.profileName}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={instance.status} />{" "}
                      {/* Badge de Status */}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Informações */}
                    <div className="space-y-2">
                      {instance.ownerJid && (
                        <div className="bg-muted/50 flex items-center gap-2 rounded-md p-2">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-xs">
                              Número
                            </p>
                            <p className="truncate font-mono text-sm">
                              {instance.ownerJid.replace("@s.whatsapp.net", "")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <TooltipActionButton
                        onClick={() =>
                          fetchCompleteInstanceDetails(instance.instanceName)
                        }
                        isLoading={loadingStatus[instance.instanceName]}
                        tooltip="Atualizar"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </TooltipActionButton>

                      {(instance.status === "qrcode" ||
                        instance.status === "connecting" ||
                        instance.status === "start") && (
                        <TooltipActionButton
                          onClick={() =>
                            handleOpenQrModal(instance.instanceName)
                          }
                          isLoading={loadingQrCode}
                          tooltip="Ver QR Code"
                          variant="secondary"
                        >
                          <QrCode className="h-4 w-4" />
                        </TooltipActionButton>
                      )}

                      {instance.status !== "offline" && (
                        <TooltipActionButton
                          onClick={async () => {
                            setLoadingStatus((prev) => ({
                              ...prev,
                              [`logout-${instance.instanceName}`]: true,
                            }));
                            const result = await logoutInstance({
                              instanceName: instance.instanceName,
                            });
                            setLoadingStatus((prev) => ({
                              ...prev,
                              [`logout-${instance.instanceName}`]: false,
                            }));
                            if (result.success) {
                              toast.success(
                                `Instância ${instance.instanceName} desconectada.`,
                              );
                              fetchCompleteInstanceDetails(
                                instance.instanceName,
                              );
                            } else {
                              toast.error(
                                result.error ||
                                  "Erro ao desconectar instância. Tente novamente.",
                              );
                            }
                          }}
                          isLoading={
                            loadingStatus[`logout-${instance.instanceName}`]
                          }
                          tooltip="Desconectar"
                        >
                          <LogOut className="h-4 w-4" />
                        </TooltipActionButton>
                      )}

                      <TooltipActionButton
                        onClick={async () => {
                          setLoadingStatus((prev) => ({
                            ...prev,
                            [`restart-${instance.instanceName}`]: true,
                          }));
                          const result = await restartInstance({
                            instanceName: instance.instanceName,
                          });
                          setLoadingStatus((prev) => ({
                            ...prev,
                            [`restart-${instance.instanceName}`]: false,
                          }));
                          if (result.success) {
                            toast.success(
                              `Instância ${instance.instanceName} reiniciada.`,
                            );
                            fetchCompleteInstanceDetails(instance.instanceName);
                          } else {
                            toast.error(
                              result.error ||
                                "Erro ao reiniciar instância. Tente novamente.",
                            );
                          }
                        }}
                        isLoading={
                          loadingStatus[`restart-${instance.instanceName}`]
                        }
                        tooltip="Reiniciar"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </TooltipActionButton>

                      {/* Novo Botão de Proxy */}
                      <TooltipActionButton
                        onClick={() =>
                          handleOpenProxyModal(instance.instanceName)
                        }
                        tooltip="Configurar Proxy"
                      >
                        <Globe className="h-4 w-4" />
                      </TooltipActionButton>

                      <TooltipActionButton
                        onClick={() =>
                          handleOpenSettings(instance.instanceName)
                        }
                        tooltip="Configurações"
                      >
                        <Settings className="h-4 w-4" />
                      </TooltipActionButton>

                      <TooltipActionButton
                        onClick={async () => {
                          if (
                            !confirm(
                              `Tem certeza que deseja deletar a instância ${instance.instanceName}? Esta ação é irreversível.`,
                            )
                          ) {
                            return;
                          }
                          setLoadingStatus((prev) => ({
                            ...prev,
                            [`delete-${instance.instanceName}`]: true,
                          }));
                          const result = await deleteInstance({
                            instanceName: instance.instanceName,
                          });
                          setLoadingStatus((prev) => ({
                            ...prev,
                            [`delete-${instance.instanceName}`]: false,
                          }));
                          if (result.success) {
                            toast.success(
                              `Instância ${instance.instanceName} deletada.`,
                            );
                            setInstances((prev) =>
                              prev.filter(
                                (inst) =>
                                  inst.instanceName !== instance.instanceName,
                              ),
                            );
                          } else {
                            toast.error(
                              result.error ||
                                "Erro ao deletar instância. Tente novamente.",
                            );
                          }
                        }}
                        isLoading={
                          loadingStatus[`delete-${instance.instanceName}`]
                        }
                        variant="destructive"
                        tooltip="Deletar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </TooltipActionButton>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal do QR Code */}
      <AnimatePresence>
        {isQrModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={handleCloseQrModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-center">
                    Conectar Instância
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingQrCode ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
                      <p className="text-muted-foreground">
                        Carregando QR Code...
                      </p>
                    </div>
                  ) : currentQrCodeData?.base64 ? (
                    <div className="space-y-4 text-center">
                      <div className="mx-auto w-fit rounded-lg bg-white p-4 shadow-sm">
                        <Image
                          src={currentQrCodeData.base64}
                          alt="QR Code"
                          width={256}
                          height={256}
                          className="h-64 w-64 object-contain"
                        />
                      </div>
                      <p className="text-muted-foreground">
                        Escaneie com o WhatsApp no seu celular
                      </p>
                    </div>
                  ) : currentQrCodeData?.pairingCode ? (
                    <div className="space-y-4 text-center">
                      <h3 className="font-semibold">Código de Pareamento</h3>
                      <div className="bg-muted rounded-lg p-4">
                        <p className="font-mono text-2xl font-bold tracking-wider">
                          {currentQrCodeData.pairingCode}
                        </p>
                      </div>
                      <p className="text-muted-foreground">
                        Use este código para conectar seu celular
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-destructive">
                        Não foi possível carregar o QR Code ou código de
                        pareamento.
                      </p>
                    </div>
                  )}

                  <Button onClick={handleCloseQrModal} className="w-full">
                    Fechar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Configurações da Instância */}
      <InstanceSettingsModal
        isOpen={settingsModal.isOpen}
        onClose={handleCloseSettings}
        instanceName={settingsModal.instanceName}
      />

      {/* Novo Modal de Proxy da Instância */}
      <InstanceProxyModal
        isOpen={proxyModal.isOpen}
        onClose={handleCloseProxyModal}
        instanceName={proxyModal.instanceName}
        onProxySetSuccess={handleProxySetSuccess}
      />
    </div>
  );
}
