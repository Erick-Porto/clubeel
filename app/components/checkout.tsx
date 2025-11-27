'use client'
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'
import style from '@/styles/checkout.module.css'
import { Loading } from '@/components/loading';
import { useCart, CartItem } from '@/context/CartContext'

initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_TOKEN!, { locale: 'pt-BR' })

interface ScheduleItem { id: number; start_schedule: string; end_schedule: string; price: number; }
interface GroupedCartItem { groupKey: string; place_name: string; date: string; isoDate: string; schedules: ScheduleItem[]; }

const formatDateBR = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const CheckoutView: React.FC<{ total: number, formatPrice: (p: any) => string }> = ({ total, formatPrice }) => {
    const [preferenceId, setPreferenceId] = useState<string | null>(null)
    const [groupedCart, setGroupedCart] = useState<GroupedCartItem[]>([])
    const { data: session } = useSession()
    const { cart } = useCart()

    useEffect(() => {
        if (!Array.isArray(cart) || cart.length === 0) {
            setGroupedCart([]);
            setPreferenceId(null);
            return;
        };

        // Agrupamento para exibição no recibo
        const groupedMap: Record<string, GroupedCartItem> = {}
        cart.forEach((it: CartItem) => {
            const placeId = String(it.place_id);
            const isoDate = String(it.start_schedule || '').split(' ')[0]; 
            const groupKey = `${placeId}_${isoDate}`;

            if (!groupedMap[groupKey]) {
                groupedMap[groupKey] = {
                    groupKey: groupKey,
                    place_name: it.place_name || 'Quadra',
                    date: formatDateBR(isoDate), 
                    isoDate: isoDate, 
                    schedules: []
                }
            }
            groupedMap[groupKey].schedules.push({
                id: it.id,
                start_schedule: it.start_schedule,
                end_schedule: it.end_schedule,
                price: it.price
            })
        })
        setGroupedCart(Object.values(groupedMap).sort((a, b) => a.isoDate.localeCompare(b.isoDate))); 

        // Criação da Preferência MP
        const items = cart.map((it: CartItem) => {
            const title = `${it.place_name} - ${it.start_schedule}`;
            const unit_price = it.price <= 0 ? 0.01 : it.price;
            return { title, quantity: 1, unit_price };
        });
        
        (async () => {
            try {
                const res = await fetch("/api/create_preference", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items }),
                })
                const data = await res.json()
                if (res.ok && data?.id) setPreferenceId(data.id)
            } catch (err) { console.error("Erro MP:", err) }
        })()
    }, [cart]) 

    return (
        <>
            <div className={style.summaryHeader}>
                <h2>Resumo do Pedido</h2>
            </div>

            {/* Lista de Itens Agrupados (Estilo Recibo) */}
            {groupedCart.map((g) => (
                <div key={g.groupKey} className={style.summaryGroup}>
                    <span className={style.summaryGroupTitle}>{g.place_name} • {g.date}</span>
                    {g.schedules.map((s) => {
                        const start = String(s.start_schedule).split(' ')[1]?.slice(0, 5);
                        const end = String(s.end_schedule).split(' ')[1]?.slice(0, 5);
                        return (
                            <div key={s.id} className={style.summaryRow}>
                                <span>{start} - {end}</span>
                                <span>R$ {formatPrice(s.price)}</span>
                            </div>
                        )
                    })}
                </div>
            ))}

            {/* Total */}
            <div className={style.summaryTotal}>
                <span>Total a pagar</span>
                <span className={style.summaryTotalValue}>R$ {formatPrice(total)}</span>
            </div>

            {/* Dados do Comprador */}
            {session?.user && (
                <div className={style.buyerInfo}>
                    <strong>Comprador</strong>
                    <span>{session.user.name}</span>
                    <span>CPF: {session.user.cpf || '...'}</span>
                </div>
            )}

            {/* Botão de Pagamento */}
            <div style={{marginTop: 20}}>
                {preferenceId ? (
                    <Wallet initialization={{ preferenceId, redirectMode: 'self' }} />
                ) : (
                    <Loading />
                )}
            </div>
        </>
    )
}

export default CheckoutView