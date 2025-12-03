'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '@/styles/schedule.module.css';
import BookingButton from '@/components/booking-button';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import { useCart } from '@/context/CartContext';
import API_CONSUME from '@/services/api-consume';
import { useIsMobile } from '../hooks/useIsMobile';

interface ReservationPayload {
    member_id: number;
    place_id: number;
    start_schedule: string; 
    end_schedule: string;   
    price: number;
    status_id: number;
}

interface LoadedContent {
    start: string;
    end: string;
    owner: number | null;
    status: number | null;
}

interface ScheduleProps { 
    place_id?: number; 
    src: string; 
    price: number; 
    dateProp?: string; 
    rules?: any[]; 
}

// --- FUNÇÃO AUXILIAR GMT-3 ---
const createGMT3Date = (dateStr: string, timeStr: string): Date => {
    return new Date(`${dateStr}T${timeStr}:00-03:00`);
};

const Schedule: React.FC<ScheduleProps> = ({ place_id, src, price, dateProp }) => {
    const { data: session } = useSession();
    const { cart, refreshCart } = useCart();
    const isMobile = useIsMobile();

    const placeId = Number(place_id);
    const numericPrice = Number(price) || 0; 
    const userId = Number(session?.user?.id);

    const [currentDate, setCurrentDate] = useState<string>(dateProp || new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (dateProp) setCurrentDate(dateProp);
    }, [dateProp]);

    const [loadedContent, setLoadedContent] = useState<LoadedContent[]>([])
    const [selectedItems, setSelectedItems] = useState<LoadedContent[]>([]);
    const [localQuantity, setLocalQuantity] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    // 1. FETCH
    const fetchData = useCallback(async () => {
        if (!placeId || !session?.accessToken || !currentDate) return;
        try {
            const response = await API_CONSUME("POST", "schedule/time-options/", {
                'Session': session.accessToken
            }, {
                date: currentDate,
                place_id: placeId
            });

            let newContent: LoadedContent[] = [];
            
            if (response) {
                if (response.quantity !== undefined) setLocalQuantity(response.quantity);

                const listToMap = Array.isArray(response) ? response : (response.data || response.options || []);
                
                const mappedContent: LoadedContent[] = listToMap.map((item: any) => ({
                    start: item[0],
                    end: item[1],
                    owner: item[2],
                    status: item[3]
                }));
                
                mappedContent.sort((a, b) => a.start.localeCompare(b.start));
                setLoadedContent(mappedContent);
            }
        } catch(error) {
            console.error('Error fetching time options:', error);
        }
    }, [placeId, session?.accessToken, currentDate]);

    useEffect(() => {
        fetchData();
        setSelectedItems([]); 
    }, [fetchData]);

    // 2. CÁLCULOS
    const userOwnedIndices = useMemo(() => {
        return loadedContent
            .map((item, index) => (item.owner === userId && (item.status === 1 || item.status === 3)) ? index : -1)
            .filter(index => index !== -1);
    }, [loadedContent, userId]);

    const userTotalAppointments = userOwnedIndices.length;

    // 3. SELEÇÃO
    const toggleSelectHour = (item: LoadedContent, index: number) => {
        if (selectedItems.includes(item)) {
            setSelectedItems(prev => prev.filter(i => i !== item));
            return;
        }
        if (item.status !== null) return; 

        if ((userTotalAppointments + selectedItems.length + 1) > localQuantity) {
            toast.error(`Limite de ${localQuantity} agendamentos atingido.`);
            return;
        }

        const currentSelectionIndices = selectedItems.map(sel => loadedContent.indexOf(sel));
        const allMyIndices = [...userOwnedIndices, ...currentSelectionIndices].sort((a, b) => a - b);

        if (allMyIndices.length > 0) {
            const firstIndex = allMyIndices[0];
            const lastIndex = allMyIndices[allMyIndices.length - 1];
            const isPrev = index === firstIndex - 1;
            const isNext = index === lastIndex + 1;

            if (!isPrev && !isNext) {
                toast.info("Selecione apenas horários consecutivos.");
                return;
            }
        }

        setSelectedItems(prev => [...prev, item].sort((a, b) => a.start.localeCompare(b.start)));
    };

    // 4. RESERVAR (CORRIGIDO)
    const handleReserve = async () => {
        if (!session?.accessToken) return toast.error("Sessão inválida.");
        if (selectedItems.length === 0) return toast.info("Selecione um horário.");

        const payload: ReservationPayload[] = selectedItems.map(item => {
            // 1. Validação com Date Object (GMT-3)
            const startObj = createGMT3Date(currentDate, item.start);
            const endObj = createGMT3Date(currentDate, item.end);

            if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
                 console.error("Data inválida gerada para:", item);
                 toast.error("Erro ao processar data.");
                 throw new Error("Data inválida");
            }

            // 2. Formatação Correta para o Backend ("YYYY-MM-DD HH:mm:ss")
            // Usamos template string simples pois já temos os valores corretos nas variáveis
            const startString = `${currentDate} ${item.start}:00`;
            const endString = `${currentDate} ${item.end}:00`;

            return {
                member_id: userId,
                place_id: placeId,
                price: numericPrice,
                status_id: 3,
                start_schedule: startString, // Agora envia a string formatada corretamente
                end_schedule: endString
            };
        });

        try {
            await API_CONSUME("POST", "schedule/", {
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_LARA_API_TOKEN,
                'Session': session.accessToken
            }, payload);

            await refreshCart();
            setSelectedItems([]);
            toast.success('Adicionado ao carrinho!');
            fetchData(); 
        } catch (error) {
            console.error("Erro ao reservar:", error);
            toast.error("Erro ao adicionar ao carrinho.");
            fetchData();
        }
    };

    // 5. RENDER
    const allActiveIndices = useMemo(() => {
        const currentSelectionIndices = selectedItems.map(sel => loadedContent.indexOf(sel));
        return [...userOwnedIndices, ...currentSelectionIndices].sort((a, b) => a - b);
    }, [userOwnedIndices, selectedItems, loadedContent]);
    
    const minActiveIndex = allActiveIndices.length > 0 ? allActiveIndices[0] : -1;
    const maxActiveIndex = allActiveIndices.length > 0 ? allActiveIndices[allActiveIndices.length - 1] : -1;
    const limitReached = (userTotalAppointments + selectedItems.length) >= localQuantity;

    const ActionButtons = () => (
        <div className={styles.actionButtonsWrapper}>
            <BookingButton
                text={selectedItems.length === 0 ? 'Selecione um horário' : `Adicionar ${selectedItems.length} Horário(s)`}
                itemsToValidate={selectedItems}
                onClick={handleReserve}
                disabled={selectedItems.length === 0}
            />
            {(cart && cart.length > 0) && (
                <BookingButton
                    text="Finalizar (Ir ao Carrinho)"
                    redirectPath="/checkout"
                    itemsToValidate={[]}
                    onClick={() => {}}
                    disabled={false}
                />
            )}
        </div>
    );

    return (
        <div className={styles.placeContainer}>
            <div className={styles.scheduleContainer}>
                <div className={styles.legendContainer}>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendAvailable}`}></span> Disponível</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendSelected}`}></span> Selecionado</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendConfirmed}`}></span> Confirmado</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendInCart}`}></span> No Carrinho</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendOccupied}`}></span> Ocupado</div>
                </div>

                {loadedContent.length === 0 ? (
                    <div className={styles.emptyState}>
                        {isLoading ? "Carregando horários..." : "Nenhum horário disponível para esta data."}
                    </div>
                ) : (
                    <ul className={styles.scheduleList}>
                        {loadedContent.map((item, index) => {
                            const isSelected = selectedItems.includes(item);
                            
                            let itemClass = styles.scheduleItem;
                            let label = `R$ ${numericPrice.toFixed(2)}`;
                            let isClickable = true;
                            let isBlocked = false;

                            if (item.owner === userId) {
                                if (item.status === 1 || item.status === 2) {
                                    itemClass += ` ${styles.myConfirmed}`;
                                    label = "Confirmado";
                                    isBlocked = true;
                                } else if (item.status === 3) {
                                    itemClass += ` ${styles.inCart}`;
                                    label = "No Carrinho";
                                    isBlocked = true;
                                }
                            } else if (item.owner !== 0) {
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Ocupado";
                                isBlocked = true;
                            }

                            if (isSelected) itemClass += ` ${styles.selected}`;

                            let isNonAdjacent = false;
                            if (!isBlocked && !isSelected && allActiveIndices.length > 0) {
                                const isNeighbor = index === minActiveIndex - 1 || index === maxActiveIndex + 1;
                                if (!isNeighbor || limitReached) {
                                    isNonAdjacent = true;
                                    itemClass += ` ${styles.nonAdjacent}`;
                                }
                            }

                            isClickable = !isBlocked;

                            return (
                                <li
                                    key={`${index}-${item.start}`}
                                    className={itemClass}
                                    onClick={() => {
                                        if (isClickable) toggleSelectHour(item, index);
                                    }}
                                >
                                    <span className={styles.timeLabel}>
                                        {item.start} - {item.end}
                                    </span>
                                    <span className={styles.priceLabel}>{label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className={styles.mobileSpacer}></div>
            </div>

            <div className={styles.rightColumn}>
                <div className={styles.calendarImageContainer}>
                    {src ? (
                        <Image src={src} width={400} height={275} alt="Local" unoptimized style={{objectFit: 'cover'}} />
                    ) : <div className={styles.imagePlaceholder}>Imagem não disponível</div>
                    }
                </div>
                <div className={styles.desktopActions}>
                    <h3>Resumo</h3>
                    <p>Selecionado Agora: <strong>R$ {(selectedItems.length * numericPrice).toFixed(2)}</strong></p>
                    <ActionButtons />
                </div>
            </div>

            {isMobile && (
                <div className={styles.mobileBottomBar}>
                    <div className={styles.mobileSummary}>
                        <span>Total:</span>
                        <strong>R$ {(selectedItems.length * numericPrice).toFixed(2)}</strong>
                    </div>
                    <div className={styles.mobileButtons}>
                       <div style={{minWidth: '140px'}}>
                            <BookingButton
                                text={selectedItems.length === 0 ? 'Adicionar' : `Adicionar (${selectedItems.length})`}
                                itemsToValidate={selectedItems}
                                onClick={handleReserve}
                                disabled={selectedItems.length === 0}
                            />
                       </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Schedule;