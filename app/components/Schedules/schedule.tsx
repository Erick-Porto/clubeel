'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '@/styles/schedule.module.css';
import BookingButton from './booking-button';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { signOut, useSession } from 'next-auth/react';
import { useCart } from '@/context/CartContext';
import API_CONSUME from '@/services/api-consume';
import { useIsMobile } from '@/hooks/useIsMobile';
import Clock from './clock';

interface ReservationPayload {
    member_id: string;
    place_id: string;
    selected_slots: string[];
    price: string;
    status_id: string;
    date:string;
}

interface LoadedContent {
    start_time: string;
    end_time: string;
    colides: boolean;
    excluded_by_rule?: object | null;
    colided_member?: User;
    colided_status_id?: number;
    colided_description?: string | null;
}

interface User {
    id: number
    cpf?: string
    title?: string
}

interface ScheduleProps {
    place_id?: number;
    src: string;
    price: number;
    dateProp?: string;
    rules?: unknown[];
    limit?: number;
}

const Schedule: React.FC<ScheduleProps> = ({ place_id, src, price, dateProp }) => {
    const { data: session } = useSession();
    const { cart, refreshCart } = useCart();
    const isMobile = useIsMobile();

    const placeId = Number(place_id);
    const numericPrice = Number(price) || 0;
    const userId = Number(session?.user.id);

    const [currentDate, setCurrentDate] = useState<string>(dateProp || new Date().toISOString().split('T')[0]);
    const [cartTotal, setCartTotal] = useState<number>(0);
    useEffect(() => {
        if (dateProp) setCurrentDate(dateProp);
    }, [dateProp]);

    const [loadedContent, setLoadedContent] = useState<LoadedContent[]>([])
    const [selectedItems, setSelectedItems] = useState<LoadedContent[]>([]);
    const [localQuantity, setLocalQuantity] = useState<number>(0);
    const fetchData = useCallback(async () => {
        if (!placeId || !session?.accessToken || !currentDate)
            return toast.error("Dados insuficientes para carregar horários.");
            // signOut({ callbackUrl: '/login' });
        try {
            cart.forEach(i =>{
                setCartTotal(prev => prev + i.price);
            })
            const response = await API_CONSUME("POST", "schedule/time-options", {}, {
                date: currentDate,
                place_id: placeId,
                member_id: userId
            });
            if (!response.ok || !response.data) {
                const msg = response.message as unknown;
                const errorText = msg instanceof Error ? msg.message : String(msg);
                
                toast.error('Erro ao buscar horários: ' + errorText);
                return;
            }
            
            const timeOptions = response.data.options;
            const listToMap = Array.isArray(timeOptions) ? timeOptions : [];
            const quantityFromPlace = response.data.limit ? response.data.limit.remaining : 2;
            setLocalQuantity(Number(quantityFromPlace));
            setLoadedContent(listToMap);
            
        } catch(error) {
            toast.error('Erro ao buscar horários: ' + (error instanceof Error ? error.message : String(error)));
        }
    }, [placeId, session, currentDate, cart]);

    useEffect(() => {
        fetchData();
        setSelectedItems([]);
    }, [fetchData]);

    const toggleSelectHour = (item: LoadedContent, index: number) => {
        if (selectedItems.includes(item)) {
            setSelectedItems(prev => prev.filter(i => i !== item));
            return;
        }

        if (( selectedItems.length ) > localQuantity) {
            toast.error(`Limite de ${localQuantity} agendamentos atingido.`);
            return;
        }

        const currentSelectionIndices = selectedItems.map(sel => loadedContent.indexOf(sel));
        
        const allMyIndices = [...currentSelectionIndices].sort((a, b) => a - b);

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

        setSelectedItems(prev => [...prev, item].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    };

    const handleReserve = async () => {
        if (!session?.accessToken) {
            return toast.error("Sessão inválida. Por favor, faça login novamente.");
            // signOut({ callbackUrl: '/login' });
        }
        if (selectedItems.length === 0) return toast.info("Selecione ao menos um horário.");

        const selectedSlots = selectedItems.map(i => `${i.start_time} - ${i.end_time}`);

        const payload: ReservationPayload = {
            member_id: userId.toString(),
            place_id: placeId.toString(),
            selected_slots: selectedSlots,
            price: numericPrice.toString(),
            status_id: '3',
            date: currentDate.toString(),
        };

        try {
            const response = await API_CONSUME("POST", "schedule", {}, payload);

            if (!response.ok) {
                toast.error(response.message || "Não foi possível reservar este horário.");
                fetchData();
                return;
            }
            await refreshCart();
            setSelectedItems([]);
            toast.success('Adicionado ao carrinho!');
            fetchData();
        } catch (error) {
            toast.error("Erro crítico ao reservar: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const allActiveIndices = useMemo(() => {
        const currentSelectionIndices = selectedItems.map(sel => loadedContent.indexOf(sel));
        return [...currentSelectionIndices].sort((a, b) => a - b);
    }, [selectedItems, loadedContent]);

    const minActiveIndex = allActiveIndices.length > 0 ? allActiveIndices[0] : -1;
    const maxActiveIndex = allActiveIndices.length > 0 ? allActiveIndices[allActiveIndices.length - 1] : -1;
    const limitReached = (selectedItems.length) >= localQuantity;
    const ActionButtons = () => (
        <div className={isMobile? styles.mobileButtons : styles.actionButtonsWrapper}>
            <div style={isMobile ? {minWidth: '140px'}:{}} id='action-buttons-1'>
                <BookingButton

                    text={selectedItems.length === 0 ? isMobile ? 'Adicionar' : 'Selecione um horário' :  isMobile ? `Adicionar (${selectedItems.length})`: `Adicionar ${selectedItems.length} Horário(s)`}
                    itemsToValidate={selectedItems}
                    onClick={handleReserve}
                    disabled={selectedItems.length === 0}
                />

            </div>
            {(cart && cart.length > 0) && (
                <div id ='action-buttons-2'>
                    <BookingButton
                        text= {isMobile ? 'Finalizar' : "Finalizar (Ir ao Carrinho)"}
                        redirectPath="/checkout"
                        itemsToValidate={[]}
                        onClick={() => {}}
                        disabled={false}
                    />
                </div>
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
                    <div className={styles.emptyState} id="schedule-list">
                        Nenhum horário disponível para esta data.
                    </div>
                ) : (
                    <ul className={styles.scheduleList} id="schedule-list">
                        {loadedContent.map((item, index) => {
                            const isSelected = selectedItems.includes(item);

                            let itemClass = styles.scheduleItem;
                            // let memberName = "";
                            // let owner = "";
                            let label = `R$ ${numericPrice.toFixed(2)}`;
                            let isClickable = true;
                            let isBlocked = false;

                            if (item.colided_member?.id === userId) {
                                if ((item.colided_status_id === 1 || item.colided_status_id === 2) && !item.colided_description) {
                                    itemClass += ` ${styles.myConfirmed}`;
                                    label = "Confirmado";
                                    isBlocked = true;
                                }
                                else if((item.colided_status_id === 1 || item.colided_status_id === 2) && item.colided_description){
                                    itemClass += ` ${styles.reservedByOthers}`;
                                    label = "Indisponível";
                                    isBlocked = true;
                                }
                                else if (item.colided_status_id === 3) {
                                    itemClass += ` ${styles.inCart}`;
                                    label = "No Carrinho";
                                    isBlocked = true;
                                }
                            } else if (item.colides && item.colided_member) {
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Ocupado";
                                isBlocked = true;
                                // memberName = item.colided_member.name ? (item.colided_member.name).split(' ') : '' 
                                // owner = `${memberName[0]} ${memberName[memberName.length -1]}`;
                            } else if (item.excluded_by_rule){
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Indisponível";
                                isBlocked = true;
                            } else if  (localQuantity === 0 && (item.colided_member?.id !== userId)){
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Indisponível";
                                isBlocked = true;
                            }


                            if (isSelected) itemClass += ` ${styles.selected}`;

                            if (!isBlocked && !isSelected && allActiveIndices.length > 0) {
                                const isNeighbor = index === minActiveIndex - 1 || index === maxActiveIndex + 1;
                                if (!isNeighbor || limitReached) {
                                    itemClass += ` ${styles.nonAdjacent}`;
                                    isBlocked = true;
                                }
                            }

                            isClickable = !isBlocked;

                            return (
                                <li
                                    id={`schedule-${index}`}
                                    key={`${index}-${item.start_time}`}
                                    className={itemClass}
                                    onClick={() => {
                                        if(item.colided_description) toast.info(item.colided_description);
                                        else if (isClickable) toggleSelectHour(item, index);
                                    }}
                                >
                                    <span className={styles.timeLabel}>
                                        {item.start_time} - {item.end_time}
                                    </span>
                                    <span className={styles.priceLabel}>{label}</span>
                                    {/* <span className={styles.priceLabel}>{owner}</span> */}
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className={styles.mobileSpacer}></div>
            </div>

            <div className={ isMobile? styles.mobileBottomBar : styles.rightColumn}>
                { isMobile ? (
                    <>
                        <div className={styles.mobileSummary}>
                            <span>Total:</span>
                            <strong>R$ {((selectedItems.length * numericPrice)+cartTotal).toFixed(2)}</strong>
                        </div>
                        <ActionButtons />
                        <div className={styles.mobileButtons}>
                        </div>
                    </>
                ) :(
                    <>
                        <div className={styles.calendarImageContainer}>
                            {src ? (
                                <Image
                                    src={src}
                                    width={400}
                                    height={275}
                                    alt="Local" 
                                    priority={true}
                                    quality={100} 
                                    style={{objectFit: 'cover'}}
                                />
                            ) : <div className={styles.imagePlaceholder}>Imagem não disponível</div>
                            }
                            
                            <div className={styles.clockWrapper} id='expire-clock'>
                                <Clock/>
                            </div>
                        </div>
                        <div className={styles.desktopActions}>
                            <h3>Resumo</h3>
                            <p>Selecionado Agora: <strong>R$ {(selectedItems.length * numericPrice).toFixed(2)}</strong></p>
                            <ActionButtons />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Schedule;