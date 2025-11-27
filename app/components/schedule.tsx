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

// --- INTERFACES ---
interface Reservation { 
    id: number; 
    start_schedule: string; 
    end_schedule: string; 
    member_id: number; 
    status_id: number; 
    place_id: number; 
    price: number; 
}

interface SelectedHour { 
    start_schedule: string; 
    end_schedule: string; 
    member_id: number; 
    status_id: number; 
    place_id: number; 
    price: number; 
}

interface Rule { 
    type: 'include' | 'exclude'; 
    start_date: string | null; 
    end_date: string | null; 
    start_time: string | null; 
    end_time: string | null; 
    quantity: number; 
    duration: string; 
    interval: string; 
}

interface ScheduleProps { place_id?: number; src: string; price: number; rules?: Rule[]; }

// --- HELPERS ---
const secondsToTimeString = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

const timeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const timePart = String(timeStr).split(/T| /)[1] || String(timeStr);
    const cleanTime = timePart.split('.')[0];
    const parts = cleanTime.split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
};

const makeDateStringFromSeconds = (dateStr: string, seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${dateStr} ${h}:${m}:${s}`;
};

const Schedule: React.FC<ScheduleProps> = ({ place_id, src, price, rules = [] }) => {
    const { data: session } = useSession();
    const { cart, refreshCart } = useCart();
    const isMobile = useIsMobile();

    const placeId = Number(place_id);
    const numericPrice = Number(price) || 0; 
    const userId = Number(session?.user?.id);

    const [currentDate, setCurrentDate] = useState<string>("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            const cleanDate = (dateParam || new Date().toISOString()).split(/T| /)[0];
            setCurrentDate(cleanDate);
        }
    }, []);

    const [selectedHours, setSelectedHours] = useState<SelectedHour[]>([]);
    const [reservedHours, setReservedHours] = useState<Reservation[]>([]);
    const [disabledHours, setDisabledHours] = useState<number[]>([]);
    const [anchorHour, setAnchorHour] = useState<number | null>(null);

    const [maxQuantity, setMaxQuantity] = useState(2);
    const [timeInterval, setTimeInterval] = useState(0);
    const [timeDuration, setTimeDuration] = useState(3600);
    const [startHourLimit, setStartHourLimit] = useState(0);
    const [endHourLimit, setEndHourLimit] = useState(22 * 3600);

    // --- 1. FETCH RESERVAS ---
    const fetchData = useCallback(async () => {
        if (!placeId || isNaN(placeId) || !session?.accessToken || !currentDate) return;
        try {
            const response = await API_CONSUME("GET", "schedule/place/", {
                'Session': session.accessToken
            }, { 
                date: currentDate,
                place_id: placeId
            });

            let rawData: Reservation[] = [];
            
            if (Array.isArray(response)) {
                rawData = response;
            } else if (response?.schedules) {
                if (Array.isArray(response.schedules)) {
                    rawData = response.schedules;
                } else if (typeof response.schedules === 'object') {
                    Object.values(response.schedules).forEach((dateGroup: any) => {
                        if (typeof dateGroup === 'object') {
                            Object.values(dateGroup).forEach((itemsArray: any) => {
                                if (Array.isArray(itemsArray)) {
                                    rawData.push(...itemsArray);
                                }
                            });
                        }
                    });
                }
            } else if (response?.data && Array.isArray(response.data)) {
                rawData = response.data;
            }
            
            const filtered = rawData.filter(item => {
                if (!item.start_schedule) return false;
                const itemDate = String(item.start_schedule).split(/T| /)[0];
                const isConfirmed = ['1', '2'].includes(String(item.status_id));
                const isThisPlace = Number(item.place_id) === placeId;
                return itemDate === currentDate && isConfirmed && isThisPlace;
            });
            
            setReservedHours(filtered);
        } catch (error) {
            console.error('Error fetching reserved hours:', error);
        }
    }, [placeId, session?.accessToken, currentDate]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // --- 2. REGRAS ---
    useEffect(() => {
        if (!currentDate) return;
        let localDisabled: number[] = [];
        let localStart = 7 * 3600;
        let localEnd = 22 * 3600;
        let localMaxQuantity = 2;
        let localDuration = 3600;
        let localInterval = 0;

        rules.forEach((rule) => {
            const valid = (!rule.start_date && !rule.end_date) || (currentDate >= (rule.start_date || '') && currentDate <= (rule.end_date || ''));
            if (!valid) return;

            if (rule.type === 'exclude' && rule.start_time && rule.end_time) {
                const start = timeToSeconds(rule.start_time);
                const end = timeToSeconds(rule.end_time);
                for (let t = start; t < end; t += 3600) {
                    if (!localDisabled.includes(t)) localDisabled.push(t);
                }
            }

            if (rule.type === 'include') {
                localStart = rule.start_time ? timeToSeconds(rule.start_time) : localStart;
                localEnd = rule.end_time ? timeToSeconds(rule.end_time) : localEnd;
                localMaxQuantity = rule.quantity || localMaxQuantity;
                localDuration = rule.duration ? timeToSeconds(rule.duration) : localDuration;
                localInterval = rule.interval ? timeToSeconds(rule.interval) : localInterval;
            }
        });

        for (let i = 0; i < 24 * 3600; i += 3600) {
            if (i < localStart || i >= localEnd) {
                if (!localDisabled.includes(i)) localDisabled.push(i);
            }
        }

        setDisabledHours(localDisabled);
        setStartHourLimit(localStart);
        setEndHourLimit(localEnd);
        setMaxQuantity(localMaxQuantity);
        setTimeDuration(localDuration);
        setTimeInterval(localInterval);
    }, [rules, currentDate]);

    // --- 3. CÁLCULOS DE OCUPAÇÃO ---
    
    // A. Meus Confirmados (Nesta Quadra)
    const myConfirmedSeconds = useMemo(() => {
        return reservedHours
            .filter(r => Number(r.member_id) === userId)
            .map(r => timeToSeconds(r.start_schedule));
    }, [reservedHours, userId]);

    // B. Meus no Carrinho (Nesta Quadra) - Para validação local
    const localCartSeconds = useMemo(() => {
        if (!cart || !Array.isArray(cart)) return [];
        return cart.filter(item => {
            const itemDate = String(item.start_schedule).split(/T| /)[0];
            return Number(item.place_id) === placeId && itemDate === currentDate;
        }).map(item => timeToSeconds(item.start_schedule));
    }, [cart, placeId, currentDate]);

    // C. Meus no Carrinho (GLOBAL - Todas as Quadras) - Para evitar conflito de horário
    const globalCartSeconds = useMemo(() => {
        if (!cart || !Array.isArray(cart)) return [];
        return cart.filter(item => {
            const itemDate = String(item.start_schedule).split(/T| /)[0];
            return itemDate === currentDate; // Mesma data, qualquer quadra
        }).map(item => timeToSeconds(item.start_schedule));
    }, [cart, currentDate]);

    // D. Selecionados Agora
    const selectedSeconds = selectedHours.map(h => timeToSeconds(h.start_schedule));

    // E. Total de Slots "Meus" nesta quadra (para adjacência)
    const allLocalSlots = useMemo(() => {
        const combined = Array.from(new Set([...myConfirmedSeconds, ...localCartSeconds, ...selectedSeconds]));
        return combined.sort((a, b) => a - b);
    }, [myConfirmedSeconds, localCartSeconds, selectedSeconds]);

    // F. Contagem Global para Limite (Carrinho Global + Confirmados Locais)
    const globalCountOnDate = useMemo(() => {
        if (!cart || !Array.isArray(cart)) return 0;
        const cartCount = cart.filter(item => {
            const itemDate = String(item.start_schedule).split(/T| /)[0];
            return itemDate === currentDate;
        }).length;
        return cartCount + myConfirmedSeconds.length;
    }, [cart, currentDate, myConfirmedSeconds]);

    useEffect(() => {
        if (selectedSeconds.length === 0) {
            setAnchorHour(null);
        }
    }, [selectedSeconds.length]);

    // --- 4. VALIDAÇÕES ---
    const step = timeDuration + timeInterval;
    const hours: number[] = [];
    const now = new Date();
    const todayString = now.toISOString().split(/T| /)[0];
    const isToday = currentDate === todayString;
    const currentHourSeconds = now.getHours() * 3600 + now.getMinutes() * 60;
    
    for (let h = startHourLimit; h < endHourLimit; h += step) {
        hours.push(h);
    }

    const isHourReserved = (hour: number) => reservedHours.some(res => timeToSeconds(res.start_schedule) === hour);

    // Bloqueia se: Desabilitado, Reservado (Outros), Passado OU EM CONFLITO GLOBAL (Carrinho em outra quadra)
    const isHourBlocked = (hour: number) => {
        if (disabledHours.includes(hour)) return true;
        
        if (isHourReserved(hour)) {
            const reservation = reservedHours.find(r => timeToSeconds(r.start_schedule) === hour);
            if (Number(reservation?.member_id) !== userId) return true; 
        }

        if (isToday && hour < currentHourSeconds) return true;

        // CORREÇÃO: Verifica se já tenho ESSE horário no carrinho (mesmo que em outra quadra)
        // Se eu já tenho esse horário no carrinho, está bloqueado para nova seleção.
        // (Exceto se for desta quadra, pois aí seria "No Carrinho", tratado depois)
        if (globalCartSeconds.includes(hour) && !localCartSeconds.includes(hour)) {
            return true;
        }

        return false;
    };

    const checkAdjacency = (hour: number): boolean => {
        if (allLocalSlots.length === 0) return true;
        const minSlot = allLocalSlots[0];
        const maxSlot = allLocalSlots[allLocalSlots.length - 1];
        const prevNeighbor = minSlot - step;
        const nextNeighbor = maxSlot + step;
        return hour === prevNeighbor || hour === nextNeighbor;
    };

    // --- 5. AÇÕES ---
    const toggleSelectHour = (hour: number) => {
        // 1. Desmarcar
        if (selectedSeconds.includes(hour)) {
            setSelectedHours(prev => prev.filter(h => timeToSeconds(h.start_schedule) !== hour));
            return;
        }

        // 2. Já tenho (Local - Confirmado ou Carrinho)
        if (myConfirmedSeconds.includes(hour) || localCartSeconds.includes(hour)) return;

        // 3. Conflito de Horário (Global)
        // Se este horário já está no carrinho em OUTRA quadra, bloqueia.
        if (globalCartSeconds.includes(hour)) {
            toast.error("Você já possui um agendamento neste horário em outra quadra.");
            return;
        }

        // 4. Limite de Quantidade (Global)
        const currentTotal = globalCountOnDate + selectedHours.length;
        if (currentTotal >= maxQuantity) {
            toast.error(`Limite global de ${maxQuantity} agendamentos por dia atingido.`);
            return;
        }

        // 5. Adjacência (Local)
        if (!checkAdjacency(hour)) {
            toast.info("Selecione apenas horários consecutivos (nesta quadra).");
            return;
        }

        const newEntry: SelectedHour = {
            member_id: userId,
            status_id: 3,
            place_id: placeId,
            price: numericPrice,
            start_schedule: makeDateStringFromSeconds(currentDate, hour),
            end_schedule: makeDateStringFromSeconds(currentDate, hour + timeDuration),
        };

        setSelectedHours(prev => [...prev, newEntry].sort((a, b) => timeToSeconds(a.start_schedule) - timeToSeconds(b.start_schedule)));
    };

    const handleReserve = async () => {
        if (!session?.accessToken) {
            toast.error("Sessão inválida.");
            return;
        }
        if (selectedHours.length === 0) {
            toast.info("Selecione um horário.");
            return;
        }

        try {
            const response = await API_CONSUME("POST", "schedule/", {
                'Session': session.accessToken
            }, selectedHours);

            if (response?.error || response?.status === 500) {
                console.warn("Backend retornou erro, mas tentando atualizar...");
            }

            await refreshCart();
            setSelectedHours([]);
            setAnchorHour(null);
            toast.success('Adicionado ao carrinho!');
        } catch (error) {
            console.error("Erro ao reservar:", error);
            await refreshCart();
        }
    };

    const ActionButtons = () => {
        const isAddDisabled = selectedHours.length === 0;
        return (
            <div className={styles.actionButtonsWrapper}>
                <BookingButton
                    text={isAddDisabled ? 'Selecione um horário' : `Adicionar ${selectedHours.length} Horário(s)`}
                    itemsToValidate={selectedHours}
                    onClick={handleReserve}
                    disabled={isAddDisabled}
                />
                {(cart?.length || 0) > 0 && (
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
    };

    return (
        <div className={styles.placeContainer}>
            <div className={styles.scheduleContainer}>
                <div className={styles.legendContainer}>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendAvailable}`}></span> Disponível</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendSelected}`}></span> Selecionado</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendOccupied}`}></span> Ocupado (Outro)</div>
                    <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendInCart}`}></span> Seu Horário</div>
                </div>

                {hours.length === 0 ? (
                    <div className={styles.emptyState}>Sem horários.</div>
                ) : (
                    <ul className={styles.scheduleList}>
                        {hours.map((hour) => {
                            const isReservedByOthers = reservedHours.some(r => timeToSeconds(r.start_schedule) === hour && Number(r.member_id) !== userId);
                            
                            const isMyConfirmed = myConfirmedSeconds.includes(hour);
                            const isMyCart = localCartSeconds.includes(hour);
                            const isMySelection = selectedSeconds.includes(hour);
                            
                            const isPast = isToday && hour < currentHourSeconds;
                            const isRuleDisabled = disabledHours.includes(hour);
                            
                            // Verifica conflito global (Carrinho em outra quadra neste horário)
                            const isGlobalConflict = globalCartSeconds.includes(hour) && !localCartSeconds.includes(hour);

                            const isBlocked = isReservedByOthers || isPast || isRuleDisabled || isGlobalConflict;

                            const isMine = isMyConfirmed || isMyCart;
                            
                            const totalCount = globalCountOnDate + selectedHours.length;
                            const limitReached = totalCount >= maxQuantity;
                            
                            let isNonAdjacent = false;
                            if (!isBlocked && !isMine && !isMySelection) {
                                if (limitReached) {
                                    isNonAdjacent = true; 
                                } else {
                                    isNonAdjacent = !checkAdjacency(hour);
                                }
                            }

                            let itemClass = styles.scheduleItem;
                            if (isMySelection) itemClass += ` ${styles.selected}`;
                            else if (isMine) itemClass += ` ${styles.inCart}`;
                            else if (isReservedByOthers) itemClass += ` ${styles.reserved}`;
                            else if (isBlocked) itemClass += ` ${styles.unavailableHour}`;
                            else if (isNonAdjacent) itemClass += ` ${styles.nonAdjacent}`;

                            let label = `R$ ${numericPrice.toFixed(2)}`;
                            if (isMyConfirmed) label = "Confirmado";
                            else if (isMyCart) label = "No Carrinho";
                            else if (isGlobalConflict) label = "Conflito Horário";
                            else if (isBlocked) label = "Indisponível";

                            return (
                                <li
                                    key={hour}
                                    className={itemClass}
                                    onClick={() => {
                                        if (isBlocked || isMine) return;
                                        toggleSelectHour(hour);
                                    }}
                                >
                                    <span className={styles.timeLabel}>
                                        {secondsToTimeString(hour)}
                                        <span className={styles.timeSeparator}>-</span>
                                        {secondsToTimeString(hour + timeDuration)}
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
                    <p>Selecionado Agora: <strong>R$ {(selectedHours.length * numericPrice).toFixed(2)}</strong></p>
                    <ActionButtons />
                </div>
            </div>

            {isMobile && (
                <div className={styles.mobileBottomBar}>
                    <div className={styles.mobileSummary}>
                        <span>Total:</span>
                        <strong>R$ {(selectedHours.length * numericPrice).toFixed(2)}</strong>
                    </div>
                    <div className={styles.mobileButtons}>
                       <ActionButtons />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Schedule;