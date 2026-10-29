'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../../styles/schedule.module.css';
import BookingButton from './booking-button';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBagShopping, faBan, faCheck, faCircleCheck, faClock } from '@fortawesome/free-solid-svg-icons';
import { useCart } from '../../../context/CartContext';
import API_CONSUME from '../../../services/api-consume';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Media, Pill } from '../UI/ui';
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

const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
        if (!placeId || !session?.accessToken || !currentDate) {
            toast.error("Dados insuficientes para carregar horários.");

            return;
        }
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
            toast.error("Sessão inválida. Por favor, faça login novamente.");
            return;

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
    const selectedTotal = selectedItems.length * numericPrice;

    // Os ids `action-buttons-1/2` são alvos do tutorial: não renomear.
    const ActionButtons = () => (
        <div className={isMobile? styles.mobileButtons : styles.actionButtonsWrapper}>
            <div id='action-buttons-1'>
                <BookingButton
                    text={selectedItems.length === 0 ? isMobile ? 'Adicionar' : 'Selecione um horário' :  isMobile ? `Adicionar (${selectedItems.length})`: `Adicionar ${selectedItems.length} ${selectedItems.length === 1 ? 'horário' : 'horários'}`}
                    icon={faBagShopping}
                    itemsToValidate={selectedItems}
                    onClick={handleReserve}
                    disabled={selectedItems.length === 0}
                />

            </div>
            {(cart && cart.length > 0) && (
                <div id ='action-buttons-2'>
                    <BookingButton
                        text= {isMobile ? 'Finalizar' : "Finalizar compra"}
                        variant="secondary"
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
            {/* Os ids `schedule-N` dos horários são alvos do tutorial (o passo 1 aponta `schedule-1`). */}
            <div className={styles.scheduleContainer}>
                <div className={styles.legendContainer} aria-label="Legenda">
                    <Pill kind="ok" icon={faCheck}>Disponível</Pill>
                    <Pill kind="info" icon={faCircleCheck}>Selecionado</Pill>
                    <Pill kind="ok" icon={faCircleCheck}>Confirmado (seu)</Pill>
                    <Pill kind="warn" icon={faBagShopping}>No carrinho</Pill>
                    <Pill kind="off" icon={faBan}>Ocupado</Pill>
                </div>

                {loadedContent.length === 0 ? (
                    <div className={styles.emptyState} id="schedule-list">
                        <FontAwesomeIcon icon={faClock} />
                        Nenhum horário disponível para esta data.
                    </div>
                ) : (
                    <ul className={styles.scheduleList} id="schedule-list">
                        {loadedContent.map((item, index) => {
                            const isSelected = selectedItems.includes(item);

                            let itemClass = styles.scheduleItem;
                            let label = formatBRL(numericPrice);
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
                                    label = "No carrinho";
                                    isBlocked = true;
                                }
                            } else if (item.colides && item.colided_member) {
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Ocupado";
                                isBlocked = true;
                            } else if (item.excluded_by_rule){
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Indisponível";
                                isBlocked = true;
                            } else if  (localQuantity === 0 && (item.colided_member?.id !== userId)){
                                itemClass += ` ${styles.reservedByOthers}`;
                                label = "Indisponível";
                                isBlocked = true;
                            }


                            if (isSelected) {
                                itemClass += ` ${styles.selected}`;
                                label = "Selecionado";
                            }

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
                                    role="button"
                                    tabIndex={isClickable || item.colided_description ? 0 : -1}
                                    aria-pressed={isSelected}
                                    aria-disabled={!isClickable}
                                    onClick={() => {
                                        if(item.colided_description) toast.info(item.colided_description);
                                        else if (isClickable) toggleSelectHour(item, index);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter' && event.key !== ' ') return;
                                        event.preventDefault();
                                        if(item.colided_description) toast.info(item.colided_description);
                                        else if (isClickable) toggleSelectHour(item, index);
                                    }}
                                >
                                    <span className={styles.timeLabel}>
                                        {item.start_time} – {item.end_time}
                                    </span>
                                    <span className={styles.priceLabel}>{label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            { isMobile ? (
                <div className={styles.mobileBottomBar}>
                    <div className={styles.mobileClock} id='expire-clock'>
                        <Clock/>
                    </div>
                    <div className={styles.mobileSummary}>
                        <span>{selectedItems.length > 0 ? `${selectedItems.length} ${selectedItems.length === 1 ? 'horário' : 'horários'} · total` : 'Total'}</span>
                        <strong>{formatBRL((selectedItems.length * numericPrice)+cartTotal)}</strong>
                    </div>
                    <ActionButtons />
                </div>
            ) : (
                <aside className={styles.rightColumn}>
                    <div className={styles.calendarImageContainer}>
                        <Media src={src || null} area="quadras" ratio="video" alt="Foto da quadra" />
                    </div>
                    <div className={styles.desktopActions}>
                        <span className={styles.asideLabel}>Seleção</span>
                        {selectedItems.length > 0 ? (
                            <ul className={styles.selectionList}>
                                {selectedItems.map((item) => (
                                    <li key={item.start_time}>
                                        <span className={styles.selectionTime}>{item.start_time} – {item.end_time}</span>
                                        <span className={styles.selectionPrice}>{formatBRL(numericPrice)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={styles.selectionEmpty}>Toque em um horário disponível para começar.</p>
                        )}
                        <div className={styles.subtotal}>
                            <span>Selecionado agora</span>
                            <strong>{formatBRL(selectedTotal)}</strong>
                        </div>
                        <ActionButtons />
                        <div className={styles.clockWrapper} id='expire-clock'>
                            <Clock/>
                        </div>
                        <p className={styles.asideHint}>
                            Os horários ficam guardados no carrinho por 10 minutos. Depois disso, voltam a ficar livres.
                        </p>
                    </div>
                </aside>
            )}
        </div>
    );
}

export default Schedule;
