import React from 'react';
import CheckoutPayment from '@/components/CheckoutPayment';
import style from '@/styles/checkout.module.css';

const PageTeste = () => {
  return(
    <div className={style.paymentSection}>
        <div style={{ marginTop: 30 }}>
            <CheckoutPayment />
        </div>
    </div>
  )
}

export default PageTeste;