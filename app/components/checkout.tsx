'use client'
import React, { useEffect, useState } from 'react'
import style from '@/styles/checkout.module.css'
import { useCart } from '@/context/CartContext'
import CheckoutPayment from './CheckoutPayment'

interface ScheduleItem { id: number; start_schedule: string; end_schedule: string; price: number; }
interface GroupedCartItem { groupKey: string; place_name: string; date: string; isoDate: string; schedules: ScheduleItem[]; }

const CheckoutView: React.FC<{ total: number}> = ({ total }) => {
    const [groupedCart, setGroupedCart] = useState<GroupedCartItem[]>([])
    const { cart } = useCart()

    useEffect(() => {
        // Validação inicial do carrinho
        if (!Array.isArray(cart) || cart.length === 0) {
            setGroupedCart([]);
            return;
        }

        const groups: { [key: string]: GroupedCartItem } = {};

        cart.forEach((item) => {
            if (!item || !item.schedule || !item.schedule.date || !item.place) {
                return;
            }

            try {
                const date = new Date(item.schedule.date);
                const dateStr = date.toLocaleDateString('pt-BR');
                const isoDate = item.schedule.date.split('T')[0];
                const groupKey = `${item.place.id}-${isoDate}`;

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        groupKey,
                        place_name: item.place.name || 'Local desconhecido',
                        date: dateStr,
                        isoDate: isoDate,
                        schedules: []
                    };
                }
                groups[groupKey].schedules.push({
                    id: item.id,
                    start_schedule: String(item.schedule.start_time),
                    end_schedule: String(item.schedule.end_time),
                    price: Number(item.schedule.price)
                });
            } catch (err) {
                console.error("Erro ao processar item do carrinho:", item, err);
            }
        });

        setGroupedCart(Object.values(groups));
    }, [cart]);

    return (
        <div>
            <p style={{marginBottom: '20px', fontSize: '28px', fontWeight: 'bold'}} className={style.checkoutTitle} >PAGAMENTO</p>
            <CheckoutPayment amount={Number(total)} />
        </div>
    )
}

export default CheckoutView