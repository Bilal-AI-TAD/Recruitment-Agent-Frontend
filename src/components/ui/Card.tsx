"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: React.ReactNode;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-[#1E3A5F] to-[#132F4C] border border-[#2A3F5E] rounded-xl p-6",
        hover && "cursor-pointer transition-all duration-200 hover:border-[#00C853] hover:shadow-[0_0_20px_rgba(0,200,83,0.2)] hover:scale-[1.02]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3 className={cn("text-lg font-semibold text-white", className)} {...props}>
      {children}
    </h3>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}
