"use client"

import style from '../../../styles/cart.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan, faCartShopping, faCalendarDays, faClock, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { useCart, CartItem } from '../../../context/CartContext';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import URIGen from '../../../utils/uriGen';
import Clock from '../Schedules/clock';
import { Media } from '../UI/ui';

const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Cart = () => {
    const { data: session } = useSession();
    const { cart, refreshCart, isLoading, removeCartItem } = useCart();

    const handleRemoveItem = async (scheduleId: number) => {

        if (!session?.accessToken) {

            toast.error("Sessão inválida. Por favor, faça login novamente.");
            return;

        }
        try {
            removeCartItem(scheduleId);
            await refreshCart();
        } catch (error) {
            toast.error("Erro ao remover agendamento: " + (error instanceof Error ? error.message : String(error)));
            toast.error("Não foi possível remover o agendamento.");
        }
    };

    const total = useMemo(() => {
        if (!cart) return 0;
        return cart.reduce((acc, item) => acc + (parseFloat(String(item.price)) || 0), 0);
    }, [cart]);

    const hhmmssToSeconds = (hms: string) => {
        const parts = String(hms).split(':').map(p => parseInt(p, 10) || 0);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
        return parts[0] * 3600;
    };
    const secondsToHHMM = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    if (isLoading) {
        return (
            <div className={style.emptyCart}>
                <p>Carregando carrinho...</p>
            </div>
        );
    }

    if (!cart || cart.length === 0) {
        return (
            <div className={style.emptyCart}>
                <FontAwesomeIcon icon={faCartShopping} size="2x" />
                <p>Seu carrinho está vazio.</p>
            </div>
        );
    }

    return (
        <div className={style.cartContainer}>
            <Clock />
            <div className={style.cartListContainer}>
                {cart.map((item: CartItem, index: number) => {
                    const startSec = hhmmssToSeconds(String(item.start_schedule).split(' ')[1] || '00:00');
                    const endSec =  hhmmssToSeconds(String(item.end_schedule).split(' ')[1] || '00:00');
                    const hourDisplay = `${secondsToHHMM(startSec)} – ${secondsToHHMM(endSec)}`

                    const isoDate = String(item.start_schedule).split(' ')[0];
                    const date = isoDate ? isoDate.split('-').reverse().join('/') : '--/--';

                    const numericPrice = item.price || 0;

                    return(
                        <div key={item.id || index} className={style.cartItem} >
                            <Link href={URIGen(item.place.name, item.place.id, isoDate)} className={style.cartItemLink}>
                                <Media src={item.place.image || null} area="quadras" ratio="sq" alt={item.place.name || 'Local'} className={style.cartItemImageContainer} />

                                <div className={style.cartItemDetails}>
                                    <h3 className={style.cartItemTitle}>{item.place.name}</h3>
                                    <div className={style.cartItemInfo}>
                                        <span>
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            {date}
                                        </span>
                                        <span>
                                            <FontAwesomeIcon icon={faClock} />
                                            {hourDisplay}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                            <span className={style.cartItemPrice}>{formatBRL(numericPrice)}</span>
                            <button
                                className={style.removeItemButton}
                                onClick={() => handleRemoveItem(item.id)}
                                title="Remover do carrinho"
                                aria-label={`Remover ${item.place.name} ${date} ${hourDisplay} do carrinho`}
                            >
                                <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                        </div>
                    )})}
            </div>

            <div className={style.cartSummary}>
                <div className={style.totalPrice}>
                    <span>Total a pagar</span>
                    <span>{formatBRL(total)}</span>
                </div>
                 <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href="/checkout" className={style.checkoutButton}>
                    Finalizar compra <FontAwesomeIcon icon={faArrowRight} />
                </Link>
            </div>
        </div>
    )
}
export default Cart;
