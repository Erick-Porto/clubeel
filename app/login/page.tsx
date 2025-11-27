"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
// CORREÇÃO: Importar o novo estilo exclusivo de autenticação
import authStyle from "@/styles/auth.module.css"; 
import Carousel from "@/components/carousel";
import AuthSidebar from "@/components/login-aside";
import { LoadingScreen } from "@/components/loading";

const AuthPage = () => {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return (
      // CORREÇÃO: Usando a classe do auth.module.css
      <div className={authStyle.page}>
        <AuthSidebar useInterface="login"/>
        {/* O Carrossel ocupa o espaço restante automaticamente (flex: 1) */}
        <Carousel height={100} controllers={false}/>
      </div>
    );
  }

  return null;
};

export default AuthPage;