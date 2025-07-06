// src/app/(protected)/_components/main-content-wrapper.tsx
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

import { useSidebar } from "@/components/ui/sidebar"; // Certifique-se de que este caminho está correto

export function MainContentWrapper({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();
  const sidebarWidth = 256;

  return (
    <motion.main
      // A margem esquerda é 0 quando a sidebar está colapsada (escondida)
      // e é igual à largura da sidebar quando ela está visível.
      initial={{ marginLeft: sidebarWidth }}
      animate={{ marginLeft: isCollapsed ? 0 : sidebarWidth }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex min-h-screen flex-1 flex-col"
    >
      {children}
    </motion.main>
  );
}
