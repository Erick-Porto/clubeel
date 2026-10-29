'use client'
import React, { useState } from 'react'
import style from '../../../styles/checkout.module.css'
import { useSession } from 'next-auth/react'
import { useCart, CartItem } from '../../../context/CartContext'
import Link from 'next/link';
import { Loading } from '../Common/loading';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faClock, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import URIGen from '../../../utils/uriGen';
import Clock from '../Schedules/clock';
import { Media } from '../UI/ui';

const CheckoutContent: React.FC<{total: number, formatPrice: (p: number) => string }> = ({ total, formatPrice }) => {
    const { data: session } = useSession();
    const { cart, refreshCart, isLoading, removeCartItem } = useCart();
    const [cancellingId, setCancellingId] = useState<number | null>(null);

    const handleCancelSchedule = async (scheduleId: number) => {
        if (cancellingId || !session?.accessToken) {
            if (!session?.accessToken) {
                toast.error("Sessão inválida. Por favor, faça login novamente.");
                return;

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

    if (isLoading) return <Loading />;

    if (!cart || cart.length === 0) {
        return (
            <div className={style.emptyCheckoutContent}>
                <h2>Seu carrinho está vazio</h2>
                <p>Explore nossas quadras e agende seu horário.</p>
            </div>
        );
    }

    return (
        <div className={style.summaryPanel}>
            <h2 className={style.checkoutTitle}>Resumo do pedido</h2>
            {/* O relógio conta pelo agendamento mais antigo do carrinho. */}
            <Clock />
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
                                <Media src={item.place.image || null} area="quadras" ratio="sq" alt={item.place.name || 'Local'} className={style.scheduleImage} />
                                <div className={style.scheduleInfo}>
                                    <h3>{item.place.name}</h3>
                                    <span><FontAwesomeIcon icon={faCalendarDays} /> {displayDate}</span>
                                    <span><FontAwesomeIcon icon={faClock} /> {startTime} – {endTime}</span>
                                </div>
                            </Link>
                            <div className={style.cartItemActions}>
                                <span className={style.priceTag}>R$ {formatPrice(numericPrice)}</span>
                                <button
                                    className={style.cancelScheduleButton}
                                    onClick={() => handleCancelSchedule(item.id)}
                                    disabled={isCancelling}
                                    type="button"
                                    title="Remover do carrinho"
                                    aria-label={`Remover ${item.place.name} ${displayDate} ${startTime} do carrinho`}
                                >
                                    {isCancelling ? <Loading small={true} /> : <FontAwesomeIcon icon={faTrashCan} />}
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
        </div>
    )
}

export default CheckoutContent;
