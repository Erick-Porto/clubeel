"use client"

import style from '@/styles/cart.module.css'
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faCartShopping, faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { useCart, CartItem } from '@/context/CartContext';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import URIGen from '@/utils/uriGen';

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
            <div className={style.cartListContainer}>
                {cart.map((item: CartItem, index: number) => {
                    const startSec = hhmmssToSeconds(String(item.start_schedule).split(' ')[1] || '00:00');
                    const endSec =  hhmmssToSeconds(String(item.end_schedule).split(' ')[1] || '00:00');
                    const hourDisplay = `${secondsToHHMM(startSec)} - ${secondsToHHMM(endSec)}`
                    
                    const isoDate = String(item.start_schedule).split(' ')[0];
                    const date = isoDate ? isoDate.split('-').reverse().join('/') : '--/--';
                    
                    // CORREÇÃO: Garantir number para toFixed
                    const numericPrice = item.price || 0;

                    return(
                        <Link href={URIGen(item.place.name, item.place.id, isoDate)} className={style.cartItem} key={item.id || index}>
                            <div className={style.cartItemImageContainer}>
                                <Image 
                                    alt={item.place.name || 'Local'} 
                                    fill
                                    priority={true}
                                    quality={100}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    className={style.cartItemImage} 
                                    src={item.place.image || '/images/placeholder.jpg'}
                                />
                            </div>
                            
                            <div className={style.cartItemDetails}>
                                <h3 className={style.cartItemTitle}>{item.place.name}</h3>
                                <div className={style.cartItemInfo}>
                                    <span>
                                        <FontAwesomeIcon icon={faCalendarAlt} width={14} />
                                        {date}
                                    </span>
                                    <span>
                                        <FontAwesomeIcon icon={faClock} width={14} />
                                        {hourDisplay}
                                    </span>
                                    <span className={style.cartItemPrice}>
                                        R$ {numericPrice.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <button 
                                className={style.removeItemButton} 
                                onClick={() => handleRemoveItem(item.id)}
                                title="Remover item"
                            >
                                <FontAwesomeIcon icon={faTrashAlt} />
                            </button>
                        </Link>
                    )})}
            </div>
            
            <div className={style.cartSummary}>
                <div className={style.totalPrice}>
                    <span>Total a Pagar</span>
                    <span>R$ {total.toFixed(2)}</span>
                </div>
                 <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href="/checkout" className={style.checkoutButton}>
                    Finalizar Compra
                </Link>
            </div>
        </div>
    )
}
export default Cart;