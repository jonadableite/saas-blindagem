// src/app/(protected)/whatsapp/components/instance-list.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Loader2,
  LogOut,
  MessageCircle,
  PowerOff,
  QrCode,
  RefreshCcw,
  Search,
  Settings,
  Trash2,
  Wifi,
  WifiOff
} from "lucide-react";
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

import { InstanceSettingsModal } from "./instance-settings-modal";

export type Instance = typeof instancesTables.$inferSelect;

interface InstanceListProps {
  initialInstances: Instance[];
}

// Componente de status elegante
const StatusBadge = ({ status }: { status: string | null }) => {
  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "open":
      case "online":
        return {
          icon: Wifi,
          variant: "default" as const,
          className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
          text: "Online",
          pulse: true,
        };
      case "connecting":
      case "start":
        return {
          icon: Activity,
          variant: "secondary" as const,
          className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
          text: "Conectando",
          pulse: true,
        };
      case "qrcode":
        return {
          icon: QrCode,
          variant: "secondary" as const,
          className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
          text: "QR Code",
          pulse: true,
        };
      case "close":
      case "offline":
        return {
          icon: WifiOff,
          variant: "secondary" as const,
          className: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
          text: "Offline",
          pulse: false,
        };
      default:
        return {
          icon: AlertCircle,
          variant: "secondary" as const,
          className: "bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400",
          text: "Desconhecido",
          pulse: false,
        };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <Badge variant={config.variant} className={cn("flex items-center gap-1.5 px-2 py-1", config.className)}>
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
      <Avatar className="h-12 w-12 border-2 border-border shadow-sm md:h-14 md:w-14">
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

      {/* Status indicator */}
      <motion.div
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background",
          isOnline ? "bg-emerald-500" : "bg-gray-400"
        )}
        animate={isOnline ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
};

// Botão de ação elegante
const ActionButton = ({
  children,
  onClick,
  disabled,
  variant = "outline",
  size = "sm",
  isLoading,
  className,
  ...props
}: any) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn("h-9 w-9 p-0", className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        children
      )}
    </Button>
  );
};

export function InstanceList({ initialInstances }: InstanceListProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>({});
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

  const instancesRef = useRef(instances);

  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  const fetchCompleteInstanceDetails = useCallback(async (instanceName: string) => {
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: true }));
    const result = await fetchInstanceDetails({ instanceName });
    setLoadingStatus((prev) => ({ ...prev, [instanceName]: false }));

    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.instanceName === instanceName) {
          if ("success" in result && result.success && result.instance) {
            return result.instance;
          } else if ("error" in result && result.error) {
            toast.error(`Erro ao obter detalhes de ${instanceName}: ${result.error}`);
            return inst;
          }
        }
        return inst;
      }),
    );
  }, []);

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
    }, 90000);

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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar instâncias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid de instâncias */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filteredInstances.length === 0 ? (
            <motion.div
              key="no-instances"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="rounded-full bg-muted p-4 mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {instances.length === 0 ? "Nenhuma instância encontrada" : "Nenhum resultado"}
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
                  ease: "easeOut"
                }}
              >
                <Card className="group h-full transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <InstanceAvatar instance={instance} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">
                            {instance.instanceName}
                          </CardTitle>
                          {instance.profileName && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {instance.profileName}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={instance.status} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Informações */}
                    <div className="space-y-2">
                      {instance.ownerJid && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Número</p>
                            <p className="text-sm font-mono truncate">
                              {instance.ownerJid.replace("@s.whatsapp.net", "")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <Bot className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Agentes AI</p>
                          <p className="text-sm font-semibold">0</p>
                        </div>
                      </div> */}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <ActionButton
                        onClick={() => fetchCompleteInstanceDetails(instance.instanceName)}
                        isLoading={loadingStatus[instance.instanceName]}
                        title="Atualizar"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </ActionButton>

                      {(instance.status === "qrcode" ||
                        instance.status === "connecting" ||
                        instance.status === "start") && (
                          <ActionButton
                            onClick={() => handleOpenQrModal(instance.instanceName)}
                            title="Ver QR Code"
                            variant="secondary"
                          >
                            <QrCode className="h-4 w-4" />
                          </ActionButton>
                        )}

                      {instance.status === "open" && (
                        <>
                          <ActionButton
                            onClick={() => handleOpenSettings(instance.instanceName)}
                            title="Configurações"
                            variant="secondary"
                          >
                            <Settings className="h-4 w-4" />
                          </ActionButton>

                          {/* <ActionButton title="Agentes AI" variant="secondary">
                            <Bot className="h-4 w-4" />
                          </ActionButton> */}
                        </>
                      )}

                      {instance.status !== "close" && instance.status !== "offline" && (
                        <ActionButton
                          onClick={async () => {
                            const result = await restartInstance({
                              instanceName: instance.instanceName,
                            });
                            if (result.success) {
                              toast.success(result.success);
                              fetchCompleteInstanceDetails(instance.instanceName);
                            } else {
                              toast.error(result.error || "Erro ao reiniciar instância.");
                            }
                          }}
                          title="Reiniciar"
                          variant="secondary"
                        >
                          <PowerOff className="h-4 w-4" />
                        </ActionButton>
                      )}

                      {instance.status === "open" && (
                        <ActionButton
                          onClick={async () => {
                            const result = await logoutInstance({
                              instanceName: instance.instanceName,
                            });
                            if (result.success) {
                              toast.success(result.success);
                              fetchCompleteInstanceDetails(instance.instanceName);
                            } else {
                              toast.error(result.error || "Erro ao fazer logout.");
                            }
                          }}
                          title="Logout"
                          variant="secondary"
                        >
                          <LogOut className="h-4 w-4" />
                        </ActionButton>
                      )}

                      <ActionButton
                        onClick={async () => {
                          const result = await deleteInstance({
                            instanceName: instance.instanceName,
                          });
                          if (result.success) {
                            toast.success(result.success);
                            setInstances((prev) =>
                              prev.filter(
                                (inst) => inst.instanceName !== instance.instanceName,
                              ),
                            );
                          } else {
                            toast.error(result.error || "Erro ao deletar instância.");
                          }
                        }}
                        title="Deletar"
                        variant="destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
                  <CardTitle className="text-center">Conectar Instância</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingQrCode ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Carregando QR Code...</p>
                    </div>
                  ) : currentQrCodeData?.base64 ? (
                    <div className="text-center space-y-4">
                      <div className="mx-auto w-fit p-4 bg-white rounded-lg shadow-sm">
                        <img
                          src={currentQrCodeData.base64}
                          alt="QR Code"
                          className="w-64 h-64 object-contain"
                        />


                      </div>
                      <p className="text-muted-foreground">
                        Escaneie com o WhatsApp no seu celular
                      </p>
                    </div>
                  ) : currentQrCodeData?.pairingCode ? (
                    <div className="text-center space-y-4">
                      <h3 className="font-semibold">Código de Pareamento</h3>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-mono font-bold tracking-wider">
                          {currentQrCodeData.pairingCode}
                        </p>
                      </div>
                      <p className="text-muted-foreground">
                        Use este código para conectar seu celular
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-destructive">
                        Não foi possível carregar o QR Code ou código de pareamento.
                      </p>
                    </div>
                  )}


                  <Button
                    onClick={handleCloseQrModal}
                    className="w-full"
                  >
                    Fechar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Modal de Configurações */}
      <InstanceSettingsModal
        instanceName={settingsModal.instanceName}
        isOpen={settingsModal.isOpen}
        onClose={handleCloseSettings}
      />
    </div>
  );
}