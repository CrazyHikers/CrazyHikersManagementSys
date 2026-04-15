"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Registration } from "./registration-manager";

type Ctx = {
  registrations: Registration[];
  setRegistrations: React.Dispatch<React.SetStateAction<Registration[]>>;
};

const RegistrationsContext = createContext<Ctx | null>(null);

export function RegistrationsStore({
  initialRegistrations,
  children,
}: {
  initialRegistrations: Registration[];
  children: ReactNode;
}) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  return (
    <RegistrationsContext.Provider value={{ registrations, setRegistrations }}>
      {children}
    </RegistrationsContext.Provider>
  );
}

export function useRegistrationsStore() {
  const ctx = useContext(RegistrationsContext);
  if (!ctx) {
    throw new Error(
      "useRegistrationsStore must be used inside <RegistrationsStore>"
    );
  }
  return ctx;
}

/**
 * Count of registrations that a manager would consider "confirmed" — i.e.
 * they took one of the confirmed/attended slots. Used by the info card at
 * the top of the activity detail page and by the Finish button guard.
 */
export function useConfirmedRegistrationCount() {
  const { registrations } = useRegistrationsStore();
  return registrations.filter(
    (r) => r.status === "registration_confirmed" || r.status === "attended"
  ).length;
}
