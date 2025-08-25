'use client'
import style from '@/styles/checkout.module.css'
import React, { useEffect } from 'react'
import { Payment } from '@mercadopago/sdk-react'
import { useState, useMemo } from 'react'
import {initMercadoPago} from "@mercadopago/sdk-react";
import API_CONSUME from '@/services/api-consume'
import { useUser } from '@/context/UserContext';

initMercadoPago('TEST-1f6158bd-fb99-4f48-97c7-96d048948e31');

const groupCartData = async (cartData: { place: string; hour: number }[], sessionToken: string | null) => {
    const groupedData: Record<string, { 
        place: string; 
        value: number; 
        total: number; 
        hours: string[]; 
        image: string; 
    }> = {};

    for (const item of cartData) {
        try {
            const response = await API_CONSUME('get', `place/${item.place}`, {
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                'Session': sessionToken,
            }, null);

            if (!groupedData[item.place]) {
                groupedData[item.place] = {
                    place: response[0].name, 
                    value: parseFloat(response[0].price), 
                    total: parseFloat(response[0].price), 
                    hours: [`${item.hour}:00 - ${item.hour + 1}:00`], 
                    image: response[0].image, 
                };
            } else {
                const lastHour = parseInt(groupedData[item.place].hours[groupedData[item.place].hours.length - 1].split(' - ')[1].split(':')[0], 10);
                if (item.hour === lastHour) {
                    groupedData[item.place].hours[groupedData[item.place].hours.length - 1] = `${groupedData[item.place].hours[groupedData[item.place].hours.length - 1].split(' - ')[0]} - ${item.hour + 1}:00`;
                } else {
                    groupedData[item.place].hours.push(`${item.hour}:00 - ${item.hour + 1}:00`);
                }
                groupedData[item.place].total += parseFloat(response[0].price); // Sum the value
            }
        } catch (error) {
            console.error(`Error fetching data for place ${item.place}:`, error);
        }
    }

    return Object.values(groupedData);
};

const CheckoutView: React.FC = () => {
    const { cart, accessToken } = useUser();
    const [groupedCartData, setGroupedCartData] = useState<{ 
        place: string; 
        value: number; 
        total: number; 
        hours: string[]; 
        image: string; 
    }[]>([]);

    const [isPaymentInitialized, setIsPaymentInitialized] = useState(false); // Adicionado para evitar duplicação

    const amount = useMemo(() => 
        groupedCartData.reduce((sum, item) => sum + item.total, 0), 
        [groupedCartData]
    );

    const initialization = useMemo(() => ({
        amount: amount > 0 ? amount : 1,
    }), [amount]);

    const customization = {
        visual:{
            style:{
                customVariables:{
                    "baseColor": "var(--grena)",
                }
            }
        },
        paymentMethods: {
            bankTransfer: "all",
            creditCard: "all",
            debitCard: "all",
            mercadoPago: ["all"],
        },
    };

    useEffect(() => {
        const fetchData = async () => {
            const groupedData = await groupCartData(cart, accessToken);
            setGroupedCartData(groupedData);
            setIsPaymentInitialized(true); // Garante que o Payment será renderizado apenas após os dados serem carregados
        };

        if (accessToken) {
            fetchData().catch((error) => {
                console.error('Error fetching cart data:', error);
            });
        }
    }, [cart, accessToken]);

    const cartItens = () => {
        return groupedCartData.map((item, index) => (
            <React.Fragment key={index}>
                <div className={style.checkoutItem} style={{backgroundImage:`url(${item.image})`}}>
                    <div className={style.checkoutItemData}>
                        <h2>{item.place}</h2>
                        <p>Horário: {item.hours.join(', ')}</p>
                        <p>Valor/Hora R${item.value}.00</p>
                    </div>
                </div>
            </React.Fragment>
        ));
    };

    return (
        <div className={style.checkout}>
            <div className={style.checkoutContainer}>
                <div className={style.checkoutLeft}>
                    {isPaymentInitialized && ( // Renderiza o Payment apenas após a inicialização
                        <Payment
                            initialization={initialization}
                            customization={customization}
                            onSubmit={async (status, additionalData) => {
                                console.log('Payment status:', status);
                                console.log('Additional data:', additionalData);
                                return Promise.resolve();
                            }}
                        />
                    )}
                </div>
                <div className={style.checkoutRight}>
                    {isPaymentInitialized && cartItens()}
                    <h2>Total: R${amount}</h2>
                </div>
            </div>
        </div>
    );
};

export default CheckoutView;