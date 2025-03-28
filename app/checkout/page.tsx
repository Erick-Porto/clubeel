'use client';

import withAuth from "@/components/auth";
import CheckoutView from "@/components/checkout";
import Footer from "@/components/footer";
import Header from "@/components/header";
import globalStyle from '@/styles/page.module.css';

const CheckoutPage = () => {
return(
    <div className={globalStyle.page}>
        <Header options={null} surgeIn={-1} onlyScroll={false}/>
        <section className={globalStyle.Section}>
            <CheckoutView/>
        </section>
        <Footer/>
    </div>
)}
export default withAuth(CheckoutPage);