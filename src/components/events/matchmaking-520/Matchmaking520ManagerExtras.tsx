"use client";

import type { ManagerExtrasProps } from "@/components/dashboard/template-extras-types";
import { BalanceCard } from "./BalanceCard";

export function Matchmaking520ManagerExtras({
  registrations,
}: ManagerExtrasProps) {
  return <BalanceCard registrations={registrations} />;
}
