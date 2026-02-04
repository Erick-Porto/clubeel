import style from '@/styles/clock.module.css';
import React, { useEffect, useState, useMemo } from 'react';
import { CartItem, useCart } from '@/context/CartContext';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHourglassStart, faHourglassEnd } from "@fortawesome/free-solid-svg-icons";


const CART_EXPIRY_TOAST_ID = "cart-expiry-toast";

export default function Clock() {
    const { cart, refreshCart } = useCart();
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [isFull, setIsFull] = useState(true); // True = Start, False = End
    const [rotation, setRotation] = useState(0);
    const [pulse, setPulse] = useState(false);
    const oldestItem = useMemo(() => {
        if (!cart || cart.length === 0) return null;
        
        return cart.reduce((prev: CartItem, curr: CartItem) => {
            const datePrev = new Date(prev.created_at).getTime();
            const dateCurr = new Date(curr.created_at).getTime();
            return datePrev < dateCurr ? prev : curr;
        });
    }, [cart]);

    useEffect(() => {
        if (!oldestItem) {
            setSecondsLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const expirationTime = new Date(oldestItem.created_at).getTime() + (10 * 60 * 1000);
            const now = new Date().getTime();
            
            const difference = Math.floor((expirationTime - now) / 1000);
            
            return difference > 600 ? 600 : (difference <= 0 ? 0 : difference);
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

        const message = `Um item do seu carrinho ira expirar em ${formatTime(secondsLeft)}`;

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