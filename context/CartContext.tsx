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
    name: string; icon: string; image_vertical: string;
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

const normalizeToBrasilia = (dateStr: string): string => {
    if (!dateStr) return "";

    const isoLike = dateStr.includes('Z') || dateStr.includes('+') 
        ? dateStr 
        : dateStr.replace(' ', 'T') + 'Z';

    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return dateStr;

    const brasiliaDate = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    return brasiliaDate
        .replace(',', '') 
        .replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true); 
    const router = useRouter();
    const pathname = usePathname();
    const hasFetchedInitial = useRef(false);

const fetchCartData = useCallback(async (token: string, userId: string | number) => {
        try {
            const response = await API_CONSUME("GET", `schedule/member/${userId}`);

            if (!response.ok || !response.data) {
                toast.warn("Falha ao buscar carrinho: " + (response.message || "Erro desconhecido"));
                return;
            }

            const apiData = response.data;
            let rawData: any[] = [];
            
            if (Array.isArray(apiData)) {
                rawData = apiData;
            } else if (apiData?.schedules) {
                if (Array.isArray(apiData.schedules)) {
                    rawData = apiData.schedules;
                } else if (typeof apiData.schedules === 'object') {
                    Object.values(apiData.schedules).forEach((dateGroup: any) => {
                        if (typeof dateGroup === 'object') {
                            Object.values(dateGroup).forEach((itemsArray: any) => {
                                if (Array.isArray(itemsArray)) rawData.push(...itemsArray);
                            });
                        }
                    });
                }
            } else if (apiData?.data && Array.isArray(apiData.data)) {
                rawData = apiData.data; 
            }

            const cleanCartItems: CartItem[] = rawData
                .filter((item: any) => String(item.status_id) === '3')
                .map((item: any) => ({
                    ...item,
                    id: Number(item.id),
                    place_id: Number(item.place_id),
                    price: Number(item.price) || 0, 
                    status_id: Number(item.status_id),
                    start_schedule: normalizeToBrasilia(item.start_schedule),
                    end_schedule: normalizeToBrasilia(item.end_schedule)
                }));

            setCart(prev => {
                if (JSON.stringify(prev) === JSON.stringify(cleanCartItems)) return prev;
                return cleanCartItems;
            });

            if(cleanCartItems.length === 0 && pathname === '/checkout')
                {toast.warn("Seu carrinho está vazio, você foi redirecionado para a página inicial.");
                router.push('/');}
            
        } catch (error) {
            toast.error("Erro crítico ao processar carrinho: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'authenticated' && session?.accessToken && session?.user?.id) {
            if (!hasFetchedInitial.current) {
                fetchCartData(session.accessToken, session.user.id);
                hasFetchedInitial.current = true;
            }
        } else if (status === 'unauthenticated') {
            setCart([]);
            setIsLoading(false);
            hasFetchedInitial.current = false;
        }
    }, [status, session, fetchCartData]);

    const refreshCart = useCallback(async () => {
        if (session?.accessToken && session?.user?.id) {
            await fetchCartData(session.accessToken, session.user.id);
        }
    }, [session, fetchCartData]);

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