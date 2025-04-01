'use client'
import style from '@/styles/checkout.module.css'
import React from 'react'
import { Payment } from '@mercadopago/sdk-react'
import { useState,useEffect } from 'react'
import { toast } from 'react-toastify'
import {initMercadoPago} from "@mercadopago/sdk-react";
import API_CONSUME from '@/services/api-consume'

initMercadoPago('TEST-1f6158bd-fb99-4f48-97c7-96d048948e31');
const groupCartData = async (cartData) => {

    const groupedData: Record<string, { 
        place: string; 
        value: number; 
        hours: string[]; 
        image: string; 
    }> = {};

    for (const item of cartData) {
        try {
            // Faz a requisição para a API usando API_CONSUME
            const response = await API_CONSUME('get', `place/${item.place}`, {
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                'Session': localStorage.getItem('___cfcsn-access-token')
            }, null);

            if (!groupedData[item.place]) {
                groupedData[item.place] = {
                    place: response[0].name, // Nome da quadra
                    value: parseFloat(response[0].price), // Valor
                    hours: [`${item.hour}:00 - ${item.hour + 1}:00`], // Horários
                    image: response[0].image, // Imagem
                };
            } else {
                // Agrupa horários consecutivos
                const lastHour = parseInt(groupedData[item.place].hours[groupedData[item.place].hours.length - 1].split(' - ')[1].split(':')[0], 10);
                if (item.hour === lastHour) {
                    groupedData[item.place].hours[groupedData[item.place].hours.length - 1] = `${groupedData[item.place].hours[groupedData[item.place].hours.length - 1].split(' - ')[0]} - ${item.hour + 1}:00`;
                } else {
                    groupedData[item.place].hours.push(`${item.hour}:00 - ${item.hour + 1}:00`);
                }
            }
        } catch (error) {
            console.error(`Error fetching data for placeId ${item.placeId}:`, error);
        }
    }

    return Object.values(groupedData);
};


const CheckoutView: React.FC = () => {
    const [groupedCartData, setGroupedCartData] = useState<{ 
        place: string; 
        value: number; 
        hours: string[]; 
        image: string; 
    }[]>([]);

    const amount = groupedCartData.reduce((sum, item) => sum + item.value, 0); // Calculate dynamically

    const initialization = {
        amount: amount || 100,
    };
    
    const customization = {
        paymentMethods: {
            bankTransfer: "all",
            creditCard: "all",
            debitCard: "all",
            mercadoPago: "all",
          },
    };

    useEffect(() => {
        const fetchData = async () => {
            const cartData = JSON.parse(localStorage.getItem('___cfcsn-cart')) || [];
            const groupedData = await groupCartData(cartData);
            setGroupedCartData(groupedData);
        };

        fetchData().catch((error) => {
            console.error('Error fetching cart data:', error);
        });
    }, []);

    const cartItens = () => {
        return (
            <>
            {groupedCartData.map((item, index) => (
            <React.Fragment key={index}>
                <div className={style.checkoutItem} style={{backgroundImage:`url(${item.image})`}}>
                    <div className={style.checkoutItemData}>
                        <h2>{item.place}</h2>
                        <p>Horário: {item.hours.join(', ')}</p>
                        <p>Valor/Hora R${item.value}.00</p>
                    </div>
                </div>
            </React.Fragment>
            ))}
            <h2>Total: R${amount}</h2>
            </>
        );
    };

    return (
        <div className={style.checkout}>
            <div className={style.checkoutContainer}>
                <div className={style.checkoutLeft}>
                    <Payment
                        initialization={initialization}
                        customization={customization}
                    />
                </div>
                <div className={style.checkoutRight}>
                    {cartItens()}
                </div>
            </div>
        </div>
    );
};

export default CheckoutView;