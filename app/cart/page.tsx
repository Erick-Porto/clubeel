"use client";
import withAuth from "@/components/auth";
import Cart from "@/components/cart";
import Footer from "@/components/footer";
import Header from "@/components/header";
import LatestAppointments from "@/components/latest-appointments";
import globalStyle from "@/styles/page.module.css";

const CartPage = (props:  & { user: string }) => {
  return (
    <div className={globalStyle.page}>
      <Header options={null} surgeIn={-1} onlyScroll={false} />
      <section className={globalStyle.Section} style={{ paddingBottom: "20px" }}>
        <Cart />
        <LatestAppointments />
      </section>
      <Footer />
    </div>
  );
};

export default withAuth(CartPage);
