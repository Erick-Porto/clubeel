import style from '@/styles/clock.module.css';
import React, { useEffect, useState, useMemo } from 'react';
import { CartItem, useCart } from '@/context/CartContext';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHourglassStart, faHourglassEnd } from "@fortawesome/free-solid-svg-icons";

const CART_EXPIRY_TOAST_ID = "cart-expiry-toast";

// ✅ 1. TRADUTOR DE DATAS: Garante que funcione em iPhones e sempre fixe no fuso de SP
const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return 0;
    
    // Troca o espaço por T (exigência do Safari)
    let safeDate = dateStr.replace(' ', 'T');
    
    // Se a data não vier com fuso, força o fuso de Brasília (-03:00) 
    // Isso impede que a data mude se o celular do usuário estiver com o fuso errado
    if (!safeDate.includes('-03:00') && !safeDate.includes('Z') && !safeDate.includes('+')) {
        safeDate += '-03:00';
    }
    
    const time = new Date(safeDate).getTime();
    return isNaN(time) ? 0 : time;
};

export default function Clock() {
    const { cart, refreshCart } = useCart();
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [isFull, setIsFull] = useState(true);
    const [rotation, setRotation] = useState(0);
    const [pulse, setPulse] = useState(false);
    
    const oldestItem = useMemo(() => {
        if (!cart || cart.length === 0) return null;
        
        return cart.reduce((prev: CartItem, curr: CartItem) => {
            // Usa o tradutor seguro para comparar as datas
            const datePrev = parseSafeDate(prev.created_at);
            const dateCurr = parseSafeDate(curr.created_at);
            return datePrev < dateCurr ? prev : curr;
        });
    }, [cart]);

    useEffect(() => {
        if (!oldestItem) {
            setSecondsLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const itemTime = parseSafeDate(oldestItem.created_at);
            const expirationTime = itemTime + (10 * 60 * 1000);
            const now = new Date().getTime();
            
            const difference = Math.floor((expirationTime - now) / 1000);
            
            // ✅ 2. REMOVIDA A TRAVA DE 600:
            // Agora, se o servidor estiver 5 segundos adiantado, o relógio mostrará 10:05 e descerá normalmente, 
            // em vez de ficar congelado e invisível para o React.
            return difference <= 0 ? 0 : difference;
        };

        setSecondsLeft(calculateTimeLeft());

        const interval = setInterval(() => {
            const timeLeft = calculateTimeLeft();
            setSecondsLeft(timeLeft);
            if (timeLeft === 0) {
                refreshCart();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [oldestItem, refreshCart]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (secondsLeft === null || secondsLeft <= 0) {
            if (toast.isActive(CART_EXPIRY_TOAST_ID)) toast.dismiss(CART_EXPIRY_TOAST_ID);
            return;
        }

        const message = `Um item do seu carrinho irá expirar em ${formatTime(secondsLeft)}`;

        if (secondsLeft <= 60) {
            setPulse(true);
            if (!toast.isActive(CART_EXPIRY_TOAST_ID)) {
                toast.warning(message, {
                    toastId: CART_EXPIRY_TOAST_ID,
                    position: "top-right",
                    autoClose: false,
                    closeOnClick: true,
                    theme: "light",
                });
            } else {
                toast.update(CART_EXPIRY_TOAST_ID, {
                    render: message,
                });
            }
        } else {
            setPulse(false);
            if (toast.isActive(CART_EXPIRY_TOAST_ID)) toast.dismiss(CART_EXPIRY_TOAST_ID);
        }
    }, [secondsLeft]);
    
    useEffect(() => {
        if (!oldestItem) return;

        const animationInterval = setInterval(() => {
            setRotation(prev => prev + 180);

            setTimeout(() => {
                setIsFull(prev => !prev);
            }, 300);
        }, 3000);

        return () => clearInterval(animationInterval);
    }, [!!oldestItem]);

    if (!cart || cart.length === 0 || secondsLeft === null) return null;

    return (
        <div className={style.clock + (pulse ? ` ${style.pulse}` : '')}>
            <div className={style.timerText}>
                <div 
                    className={style.iconWrapper} 
                    style={{ transform: `rotate(${rotation}deg)` }}
                >
                    <FontAwesomeIcon 
                        icon={isFull ? faHourglassEnd : faHourglassStart} 
                    />
                </div>
                {secondsLeft > 0 ? formatTime(secondsLeft) : `Expirando`}
            </div>
        </div>
    );
}