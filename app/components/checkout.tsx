'use client'
import React from 'react'
import style from '@/styles/checkout.module.css'
import CheckoutPayment from './CheckoutPayment'

const CheckoutView: React.FC<{ total: number}> = ({ total }) => {
    return (
        <div>
            <p style={{marginBottom: '20px', fontSize: '28px', fontWeight: 'bold'}} className={style.checkoutTitle} >PAGAMENTO</p>
            <CheckoutPayment amount={Number(total)} />
        </div>
    )
}

export default CheckoutView