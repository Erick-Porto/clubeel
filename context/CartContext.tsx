'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';
import { toast } from 'react-toastify';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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

const normalizeToBrasilia = (dateStr: string): string => {
    if (!dateStr) return "";

    const isoLike = dateStr.includes('Z') || dateStr.includes('+') 
        ? dateStr 
        : dateStr.replace(' ', 'T') + 'Z';

    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return dateStr;

    // Ajuste de fuso caso necessário (mantido do seu original)
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
    const searchParams = useSearchParams();

    const fetchCartData = useCallback(async (token: string, userId: string | number) => {
        setIsLoading(true);
        try {
            const response = await API_CONSUME('GET', `schedule/user/${userId}/pending`, {
                'Session': token
            });

            if (!response.ok || !response.data) {
                setCart([]);
                return;
            }

            const rawData = response.data.data || response.data;
            if (!Array.isArray(rawData)) {
                setCart([]);
                return;
            }

            const cleanCartItems: CartItem[] = rawData
                .filter((item: any) => String(item.status_id) === '3')
                .map((item: any) => {
                    // ✅ CORREÇÃO 1: Trata a data para funcionar no Safari e ajustar o fuso do relógio
                    const safeCreatedAt = item.created_at && !item.created_at.includes('T') 
                        ? item.created_at.replace(' ', 'T') + 'Z' 
                        : item.created_at;

                    return {
                        ...item,
                        id: Number(item.id),
                        place_id: Number(item.place_id),
                        price: Number(item.price) || 0, 
                        status_id: Number(item.status_id),
                        start_schedule: normalizeToBrasilia(item.start_schedule),
                        end_schedule: normalizeToBrasilia(item.end_schedule),
                        created_at: safeCreatedAt // Usa a data formatada e segura
                    };
                });

            setCart(prev => {
                if (JSON.stringify(prev) === JSON.stringify(cleanCartItems)) return prev;
                return cleanCartItems;
            });

            // ✅ CORREÇÃO 2: Regra de redirecionamento removida daqui de dentro!

        } catch (error) {
            toast.error("Erro crítico ao processar carrinho: " + (error instanceof Error ? error.message : String(error)));
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

    // ✅ CORREÇÃO 3: Observador dedicado para expulsar quem está com o carrinho vazio,
    // mas que ignora se a pessoa acabou de concluir a compra (status === 'success')
    const statusParam = searchParams?.get('status');
    useEffect(() => {
        if (!isLoading && cart.length === 0 && pathname === '/checkout' && statusParam !== 'success') {
            toast.warn("O seu carrinho está vazio, você foi redirecionado para a página inicial.");
            router.push('/');
        }
    }, [cart.length, isLoading, pathname, router, statusParam]);

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