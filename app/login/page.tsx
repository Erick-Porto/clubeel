import React from "react";
import styles from "@/styles/page.module.css";
import Carousel from "@/components/carousel";
import AuthSidebar from "@/components/login-aside";

const AuthPage = () => {
  return (
    <div className={styles.page}>
      <AuthSidebar useInterface="login"/>
      <Carousel height={100} controllers={false}/>
    </div>
  );
};

export default AuthPage;