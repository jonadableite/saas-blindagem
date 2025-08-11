"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

interface ChartContainerProps {
  children: ReactNode;
  config?: ChartConfig;
  className?: string;
}

export function ChartContainer({ children, config, className }: ChartContainerProps) {
  return (
    <div className={cn("w-full", className)}>
      {children}
    </div>
  );
}

interface ChartTooltipProps {
  children: ReactNode;
  className?: string;
}

export function ChartTooltip({ children, className }: ChartTooltipProps) {
  return (
    <div className={cn("bg-background border border-border rounded-lg shadow-lg p-2", className)}>
      {children}
    </div>
  );
}

interface ChartTooltipContentProps {
  hideLabel?: boolean;
  className?: string;
}

export function ChartTooltipContent({ hideLabel, className }: ChartTooltipContentProps) {
  return (
    <div className={cn("text-sm", className)}>
      {!hideLabel && <div className="font-medium">Valor</div>}
    </div>
  );
}
