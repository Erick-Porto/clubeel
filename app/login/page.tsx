"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import authStyle from "@/styles/auth.module.css"; 
import Carousel from "@/components/Common/carousel";
import AuthSidebar from "@/components/Common/login-aside";
import { LoadingScreen } from "@/components/Common/loading";

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