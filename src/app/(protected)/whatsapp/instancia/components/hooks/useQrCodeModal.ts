// src/app/(protected)/whatsapp/instancia/components/hooks/useQrCodeModal.ts
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getInstanceQrCode } from "@/actions/instance";

interface QrCodeData {
  base64?: string;
  pairingCode?: string;
}

interface QrModalState {
  open: boolean;
  data?: QrCodeData;
  instanceName: string | null;
}

export function useQrCodeModal() {
  const [qrModal, setQrModal] = useState<QrModalState>({
    open: false,
    instanceName: null,
  });
  const [isLoadingQrCode, setIsLoadingQrCode] = useState(false);
  const [qrCodeAttempt, setQrCodeAttempt] = useState(0);

  const fetchQrCodeWithRetry = useCallback(async (instanceName: string) => {
    setQrModal({ open: true, instanceName, data: undefined });
    setIsLoadingQrCode(true);

    const maxRetries = 10;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setQrCodeAttempt(attempt);

      try {
        const result = await getInstanceQrCode({ instanceName });

        if ("success" in result && result.success) {
          if (result.qrCode || result.pairingCode) {
            setQrModal((prev) => ({
              ...prev,
              data: { base64: result.qrCode, pairingCode: result.pairingCode },
            }));
            setIsLoadingQrCode(false);
            setQrCodeAttempt(0);
            return;
          }
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    setIsLoadingQrCode(false);
    setQrCodeAttempt(0);
    toast.error(
      `Não foi possível carregar o QR Code para ${instanceName}. A instância pode ainda estar inicializando. Tente novamente em alguns instantes.`,
    );
    setQrModal({ open: false, instanceName: null });
  }, []);

  const closeQrModal = useCallback(() => {
    setQrModal({ open: false, instanceName: null });
    setQrCodeAttempt(0);
  }, []);

  return {
    qrModal,
    isLoadingQrCode,
    qrCodeAttempt,
    fetchQrCodeWithRetry,
    closeQrModal,
  };
}
