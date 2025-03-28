import React from "react";
import globalStyle from "@/styles/page.module.css";
import Carousel from "@/components/carousel";
import AuthSidebar from "@/components/login-aside";

const AuthPage = () => {
  return (
    <div className={globalStyle.page}>
      <AuthSidebar useInterface="login"/>
      <Carousel height={100} controllers={false}/>
    </div>
  );
};

export default AuthPage;