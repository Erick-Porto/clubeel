'use client'
import React from 'react'
import style from '../../../styles/checkout.module.css'
import CheckoutPayment from './CheckoutPayment'

const CheckoutView: React.FC<{ total: number}> = () => {
    return (
        <div>
            <p style={{marginBottom: '20px', fontSize: '28px', fontWeight: 'bold'}} className={style.checkoutTitle} >PAGAMENTO</p>
            <CheckoutPayment />
        </div>
    )
}

export default CheckoutView