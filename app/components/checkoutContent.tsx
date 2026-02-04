'use client'
import React, { useMemo, useState } from 'react'
import style from '@/styles/checkout.module.css'
import { signOut, useSession } from 'next-auth/react'
import { useCart, CartItem } from '@/context/CartContext'
import Link from 'next/link';
import { Loading } from './loading';
import { toast } from 'react-toastify';
import Image from 'next/image'
import URIGen from '@/utils/uriGen';
import Clock from './clock'
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>);
const ClockIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);

const CheckoutContent: React.FC<{total: number, formatPrice: (p: number) => string }> = ({ total, formatPrice }) => {
    const { data: session } = useSession();
    const { cart, refreshCart, isLoading, removeCartItem } = useCart();
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const oldestItem = useMemo(() => {
        if (!cart || cart.length === 0) return null;
        
        return cart.reduce((prev: CartItem, curr: CartItem) => {
            const datePrev = new Date(prev.created_at).getTime();
            const dateCurr = new Date(curr.created_at).getTime();
            return datePrev < dateCurr ? prev : curr;
        });
    }, [cart]);

    const handleCancelSchedule = async (scheduleId: number) => {
        if (cancellingId || !session?.accessToken) {
            if (!session?.accessToken) {
                toast.error("Sessão inválida. Por favor, faça login novamente.");
                return signOut({ callbackUrl: '/login' });
            }
        }
        setCancellingId(scheduleId);

        try {
            removeCartItem(scheduleId);
            await refreshCart();
        } catch (error) {
            toast.error("Erro ao remover.");
            toast.error("Erro: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setCancellingId(null);
        }
    }

    if (isLoading) return <div style={{padding: 40}}><Loading /></div>;

    if (!cart || cart.length === 0) {
        return (
            <div className={style.emptyCheckoutContent}>
                <h2>Seu carrinho está vazio</h2>
                <p>Explore nossas quadras e agende seu horário.</p>
            </div>
        );
    }

    console.log(cart);
    console.log(oldestItem);

    return (
        <>
            <h1 className={style.checkoutTitle}>RESUMO DO PEDIDO</h1>
            <div className={style.cartList}>
                {cart.map((item: CartItem) => {
                    const isoDate = (item.start_schedule || '').split(' ')[0];
                    const displayDate = isoDate ? isoDate.split('-').reverse().join('/') : '--/--';
                    const startTime = (item.start_schedule || '').split(' ')[1]?.slice(0, 5) || '';
                    const endTime = (item.end_schedule || '').split(' ')[1]?.slice(0, 5) || '';
                    const isCancelling = cancellingId === item.id;
                    const numericPrice = Number(item.price) || 0;

                    return (
                        <div key={item.id} className={`${style.cartItem} ${isCancelling ? style.itemCancelling : ''}`}>
                            <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={URIGen(item.place.name || '', item.place_id, isoDate)} className={style.cartItemContent}>
                                <Image
                                    className={style.scheduleImage}
                                    src={item.place.image || '/images/placeholder.jpg'}
                                    alt={item.place.name || 'Local'}
                                    width={100}
                                    height={100}
                                    priority={true}
                                    quality={100}
                                />
                                <div className={style.scheduleInfo}>
                                    <h2>{item.place.name}</h2>
                                    <h3><CalendarIcon /> {displayDate}</h3>
                                    <h3><ClockIcon /> {startTime} - {endTime}</h3>
                                    <span className={style.priceTag}>
                                        R$ {numericPrice.toFixed(2)}
                                    </span>
                                </div>
                            </Link>
                            <div className={style.cartItemActions}>
                                {item.id === oldestItem?.id && <Clock />}
                                <button
                                    className={style.cancelScheduleButton}
                                    onClick={() => handleCancelSchedule(item.id)}
                                    disabled={isCancelling}
                                    type="button"
                                    title="Remover item"
                                >
                                    {isCancelling ? <Loading small={true} /> : <TrashIcon />}
                                </button>
                            </div>
                        </div>
                    )
                })}
                
            </div>
            <div className={style.summaryTotal}>
                <span>Total a pagar</span>
                <span className={style.summaryTotalValue}>R$ {formatPrice(total)}</span>
            </div>
        </>

    )
}

export default CheckoutContent;