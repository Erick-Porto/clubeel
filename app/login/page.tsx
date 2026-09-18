"use client";

import React, { Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeCallbackUrl } from "../../utils/callback-url";
import authStyle from "../../styles/auth.module.css";
import Carousel from "../components/Common/carousel";
import AuthSidebar from "../components/Common/login-aside";
import { LoadingScreen } from "../components/Common/loading";

const AuthContent = () => {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Quem já está logado e cai no /login volta para onde queria ir (o
  // callbackUrl que o middleware anexou), ou para a home se não havia destino.
  const callbackUrl = safeCallbackUrl(searchParams?.get('callbackUrl'));

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return (
      <div className={authStyle.page}>
        <AuthSidebar useInterface="login"/>
        <Carousel height={100} controllers={false}/>
      </div>
    );
  }

  return null;
};

/**
 * `useSearchParams` (aqui e no AuthSidebar) tira a página do prerender
 * estático; sem o Suspense o build do Next quebra em /login.
 */
const AuthPage = () => (
  <Suspense fallback={<LoadingScreen />}>
    <AuthContent />
  </Suspense>
);

export default AuthPage;
