'use client'
import React from 'react'
import style from '../../../styles/checkout.module.css'
import CheckoutPayment from './CheckoutPayment'

const CheckoutView: React.FC<{ total: number}> = () => {
    return (
        <div className={style.paymentPanel}>
            <h2 className={style.checkoutTitle}>Pagamento</h2>
            <CheckoutPayment />
        </div>
    )
}

export default CheckoutView
