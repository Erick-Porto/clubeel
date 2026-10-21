"use client";

import { SessionProvider } from "next-auth/react";
import { comBase } from "../../utils/base-path";

type Props = {
  children?: React.ReactNode;
};

export const NextAuthProvider = ({ children }: Props) => {
  // Na homologação o /api/auth também mora sob o prefixo (/homolog/api/auth).
  return <SessionProvider basePath={comBase("/api/auth")}>{children}</SessionProvider>;
};