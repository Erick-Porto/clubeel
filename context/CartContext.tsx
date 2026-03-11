'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';
import { toast } from 'react-toastify';
import { usePathname, useRouter } from 'next/navigation';

export interface CartItem {
    id: number;
    place_id: number;
    place: Place;
    place_name?: string;
    place_image?: string;
    start_schedule: string; 
    end_schedule: string;
    price: number; 
    member_id?: number;
    status_id?: number;
    created_at: string;
}

interface Place {
    id: number;
    name: string; 
    icon: string; 
    image_vertical: string;
    image: string;
}

interface CartContextType {
    cart: CartItem[];
    isLoading: boolean;
    refreshCart: () => Promise<void>;
    clearCart: () => void;
    removeCartItem: (id: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const normalizeToBrasilia = (dateStr: any): string => {
    if (!dateStr || typeof dateStr !== 'string') return dateStr || "";

    const isoLike = dateStr.includes('Z') || dateStr.includes('+') 
        ? dateStr 
        : dateStr.replace(' ', 'T') + 'Z';

    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return dateStr;

    const brasiliaDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
    return brasiliaDate.toISOString().replace('T', ' ').substring(0, 19);
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session } = useSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const hasFetchedInitial = useRef(false);
    
    const pathname = usePathname();
    const router = useRouter();
    const fetchCartData = useCallback(async (token: string, userId: string | number) => {
        setIsLoading(true);
        try {
            const response = await API_CONSUME('GET', `schedule/member/${userId}/`, {
                'Session': token
            });

            if (!response.ok || !response.data) {
                setCart([]);
                return;
            }

            // Tenta encontrar o array em qualquer lugar do objeto
            let rawData = response.data;
            if (!Array.isArray(rawData)) {
                if (rawData?.data && Array.isArray(rawData.data)) rawData = rawData.data;
                else if (rawData?.pending && Array.isArray(rawData.pending)) rawData = rawData.pending;
                else if (typeof rawData === 'object') {
                    // Se estiver noutra propriedade desconhecida, procura o primeiro array que encontrar
                    const possibleArray = Object.values(rawData).find(val => Array.isArray(val));
                    rawData = possibleArray || [];
                } else {
                    rawData = [];
                }
            }

            // Filtro mais flexível (aceita '3', 3, ou propriedade 'status' em vez de 'status_id')
            const filteredData = rawData.filter((item: any) => {
                const status = String(item.status_id || item.status || '');
                return status === '3';
            });

            const cleanCartItems: CartItem[] = filteredData.map((item: any) => {
                let safeCreatedAt = item.created_at;
                if (typeof item.created_at === 'string' && !item.created_at.includes('T')) {
                    safeCreatedAt = item.created_at.replace(' ', 'T') + 'Z';
                }

                return {
                    ...item,
                    id: Number(item.id),
                    place_id: Number(item.place_id),
                    price: Number(item.price) || 0, 
                    status_id: Number(item.status_id || item.status || 3),
                    start_schedule: normalizeToBrasilia(item.start_schedule),
                    end_schedule: normalizeToBrasilia(item.end_schedule),
                    created_at: safeCreatedAt 
                };
            });

            setCart(prev => {
                if (JSON.stringify(prev) === JSON.stringify(cleanCartItems)) return prev;
                return cleanCartItems;
            });

        } catch (error) {
            toast.error("Erro ao processar carrinho.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refreshCart = useCallback(async () => {
        if (session?.accessToken && session?.user?.id) {
            await fetchCartData(session.accessToken, session.user.id);
        } else {
            setCart([]);
        }
    }, [session, fetchCartData]);

    useEffect(() => {
        if (session?.accessToken && session?.user?.id) {
            if (!hasFetchedInitial.current) {
                fetchCartData(session.accessToken, session.user.id);
                hasFetchedInitial.current = true;
            }
        } else if (session === null) {
            setCart([]);
            setIsLoading(false);
        }
    }, [session, fetchCartData]);

    useEffect(() => {
        if (session?.accessToken && session?.user?.id) {
            if (pathname === '/profile' || pathname === '/checkout' || pathname === '/cart') {
                fetchCartData(session.accessToken, session.user.id);
            }
        }
    }, [pathname, session, fetchCartData]);

    useEffect(() => {
        const isSuccessScreen = typeof window !== 'undefined' && window.location.search.includes('status=success');

        if (!isLoading && cart.length === 0 && pathname === '/checkout' && !isSuccessScreen) {
            router.push('/');
        }
    }, [cart.length, isLoading, pathname, router]);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const removeCartItem = useCallback(async (scheduleId: number) => {
        if (!session?.accessToken) return;

        const previousCart = [...cart]; 
        setCart(current => current.filter(item => item.id !== scheduleId));

        try {
            const response = await API_CONSUME("DELETE", `schedule/delete-pending`, {},{
                id: scheduleId
            });

            if (!response.ok) {
                throw new Error(response.message || "Erro no backend ao deletar");
            }

            toast.success("Item removido.");
            
            if (session.user?.id) {
                fetchCartData(session.accessToken, session.user.id);
            }

        } catch (error) {
            toast.error("Erro ao remover item: " + (error instanceof Error ? error.message : String(error)));
            setCart(previousCart);
        }
    }, [cart, session, fetchCartData]);

    const value = useMemo(() => ({
        cart,
        isLoading,
        refreshCart,
        clearCart,
        removeCartItem 
    }), [cart, isLoading, refreshCart, clearCart, removeCartItem]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart deve ser usado dentro de um CartProvider');
    }
    return context;
};