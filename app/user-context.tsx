"use client";

import { createContext, useContext } from "react";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  xp: number;
};

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): CurrentUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser deve ser usado dentro de <UserProvider>.");
  return user;
}
