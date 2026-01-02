"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
      <div className={authStyle.page}>
        <AuthSidebar useInterface="login"/>
        <Carousel height={100} controllers={false}/>
      </div>
    );
  }

  return null;
};

export default AuthPage;