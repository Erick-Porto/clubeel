'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';

export interface CartItem {
    id: number;
    place_id: number;
    place_name: string;
    place_image?: string;
    start_schedule: string; 
    end_schedule: string;
    price: number; 
    member_id?: number;
    status_id?: number;
}

interface CartContextType {
    cart: CartItem[];
    isLoading: boolean;
    refreshCart: () => Promise<void>;
    clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true); 

    const fetchCartData = async (token: string) => {
        try {
            // CORREÇÃO 1: Adicionar timestamp para evitar cache do navegador/next.js
            // Isso força o sistema a buscar a lista REAL atualizada após um delete.
            const timestamp = new Date().getTime();
            
            const response = await API_CONSUME("GET", `schedule/?_t=${timestamp}`, {
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_LARA_API_TOKEN,
                'Session': token,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            // Normalização Robusta (Mantida e reforçada)
            let rawData: any[] = [];
            
            if (Array.isArray(response)) {
                rawData = response;
            } else if (response?.schedules) {
                if (Array.isArray(response.schedules)) {
                    rawData = response.schedules;
                } else if (typeof response.schedules === 'object') {
                    Object.values(response.schedules).forEach((dateGroup: any) => {
                        if (typeof dateGroup === 'object') {
                            Object.values(dateGroup).forEach((itemsArray: any) => {
                                if (Array.isArray(itemsArray)) rawData.push(...itemsArray);
                            });
                        }
                    });
                }
            } else if (response?.data && Array.isArray(response.data)) {
                rawData = response.data; 
            }

            const cleanCartItems: CartItem[] = rawData
                .filter((item: any) => String(item.status_id) === '3')
                .map((item: any) => ({
                    ...item,
                    id: Number(item.id),
                    place_id: Number(item.place_id),
                    price: Number(item.price) || 0, 
                    status_id: Number(item.status_id)
                }));

            setCart(prev => {
                if (JSON.stringify(prev) === JSON.stringify(cleanCartItems)) return prev;
                return cleanCartItems;
            });

        } catch (error) {
            console.error("Erro no CartContext:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.accessToken) {
            fetchCartData(session.accessToken);
        } else if (status === 'unauthenticated') {
            setCart([]);
            setIsLoading(false);
        }
    }, [status, session?.accessToken]);

    const refreshCart = useCallback(async () => {
        if (session?.accessToken) {
            await fetchCartData(session.accessToken);
        }
    }, [session?.accessToken]);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const value = useMemo(() => ({
        cart,
        isLoading,
        refreshCart,
        clearCart
    }), [cart, isLoading, refreshCart, clearCart]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart deve ser usado dentro de um CartProvider');
    return context;
};