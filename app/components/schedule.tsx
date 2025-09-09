'use client'

import React, { useState, useEffect } from 'react';
import styles from '@/styles/schedule.module.css';
import BookingButton from '@/components/booking-button';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useUser } from '@/context/UserContext';
import API_CONSUME from '@/services/api-consume';
import { ApiError } from 'next/dist/server/api-utils';
import { time } from 'console';

interface Reservation {
    start_schedule: string; // ISO date string
    end_schedule: string;   // ISO date string
    start?: string;         // ISO date string (same as start_schedule)
    end?: string;           // ISO date string (same as end_schedule)
    member_id: number;
    status: number;
    place_id: number;
    price: number;
    place_name?: string | null;
    place_image?: string | null;
}

interface SelectedHour {
    start_schedule: string; // ISO date string
    end_schedule: string;   // ISO date string
    start?: string;         // ISO date string (same as start_schedule)
    end?: string;           // ISO date string (same as end_schedule)
    owner: number;
    status: number;
    place_id: number;
    price: number;
}

interface ScheduleProps {
    place_id?: number;
    place?: number;
    src: string;
    price: number;
    rules?: any[];
}

const secondsToTimeString = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const HHMMSSToSeconds = (hmsOrIso: string) => {
    if (!hmsOrIso) return NaN;
    // aceita tanto "YYYY-MM-DDTHH:MM:SS" quanto "YYYY-MM-DD HH:MM:SS" ou apenas "HH:MM[:SS]"
    let timePart = String(hmsOrIso);
    if (timePart.includes('T') || timePart.includes(' ')) {
        timePart = timePart.split(/T| /)[1] || '';
    }
    // remove timezone / milliseconds
    timePart = timePart.split('.')[0].split('Z')[0].split('+')[0];
    const parts = timePart.split(':').map(p => Number(p));
    if (parts.length < 2 || (isNaN(parts[0]) && isNaN(parts[1]))) return NaN;
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    const s = Number(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
}

const makeISODateFromSeconds = (dateStr: string, seconds: number) => {
    const time = secondsToTimeString(seconds);
    // Retorna data/hora no formato local "YYYY-MM-DDTHH:MM:SS" sem converter para UTC (evita deslocamento por timezone)
    return `${dateStr}T${time}`;
}

const Schedule: React.FC<ScheduleProps> = ({place_id, place, src, price, rules = [] }) => {
    const { cart, setCart, accessToken, User } = useUser();
    
    if (typeof window !== 'undefined') {
        (window as any).__rendering_component = 'Schedule';
    }
    const placeId = Number(place_id ?? place ?? NaN);
    const currentDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours() * 3600;

    let thisplace = placeId;
    const hours: number[] = [];
    const unavailableHours: number[] = [currentHour];
    const [selectedHours, setSelectedHours] = useState<SelectedHour[]>([]);
    const [prevSelectedHours, setPrevSelectedHours] = useState<SelectedHour[]>([]);
    const [reservedHours, setReservedHours] = useState<Reservation[]>([]);
    const [alternateText, setAlternateText] = useState<string>("Reservar");
    const [redirect, setRedirect] = useState(false);
    const [disabledHours, setDisabledHours] = useState<number[]>([]);
    const [maxQuantity, setMaxQuantity] = useState(2);
    const [timeInterval, setTimeInterval] = useState(0); 
    const [timeDuration, setTimeDuration] = useState(3600);
    const [localPrice, setLocalPrice] = useState(0);
    const [startHourLimit, setStartHourLimit] = useState(0);
    const [endHourLimit, setEndHourLimit] = useState(22 * 3600);

    const fetchData = async (place_id: number) => {
        
    if (!place_id || isNaN(Number(place_id)) || place_id === undefined){
        console.warn('fetchData called with invalid place_id:', place_id);
        console.trace();
        return;
    }
    try {
            const response = await API_CONSUME("GET", `schedule/place/${place_id}`, {
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                'Session': accessToken
            }, null);
            
            const data = response?.schedules ?? [];
            
            let targetDate: string | null = null;
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const dateParam = params.get('date');
                if (dateParam) {
                    const parsed = new Date(dateParam);
                    if (!isNaN(parsed.getTime())) {
                        targetDate = parsed.toISOString().split('T')[0];
                    }
                }
            }

            const filtered = Array.isArray(data) ? data.filter((item: any) => {
                if (!item.start_schedule || !item.end_schedule) return false;
                if(item.status!='1') return false;
                const s = new Date(item.start_schedule);
                const e = new Date(item.end_schedule);
                if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
                const sDate = s.toISOString().split('T')[0];
                const eDate = e.toISOString().split('T')[0];
                if (sDate !== currentDate) return false;
                if (sDate !== eDate) return false;
                if (targetDate !== null) return sDate === targetDate;
                return false;
            }) : [];
            setReservedHours(filtered);
            setSelectedHours([]);
        } catch (error) {
            console.error('Error fetching reserved hours:', error);
        }
    };
    
    useEffect(() => {
        if (!thisplace || isNaN(thisplace)) return;
        fetchData(thisplace);
    }, [thisplace, accessToken]);

    useEffect(() => {
        if (!thisplace || isNaN(thisplace)) return;
        const interval = setInterval(() => {
            fetchData(thisplace);
        }, 30000);
        return () => clearInterval(interval);
    }, [thisplace, accessToken]);

    useEffect(() => {
        let localDisabled: number[] = [];
        let localStart = null;
        let localEnd = null;
        let localMaxQuantity = 2;
        let localDuration = 3600;
        let localInterval = 0;

        rules.forEach((rule: any) => {
            const valid = (rule.start_date === null && rule.end_date === null) ||
                (rule.start_date && rule.end_date && currentDate >= rule.start_date && currentDate <= rule.end_date);
            if (!valid) return;

            if (rule.type === 'exclude') {
                if (rule.start_time && rule.end_time) {
                    const start = HHMMSSToSeconds(rule.start_time);
                    const end = HHMMSSToSeconds(rule.end_time);
                    for (let t = start; t < end; t += 3600) {
                        const hour = t;
                        if (hour !== currentHour && !localDisabled.includes(hour)) localDisabled.push(hour);
                    }
                }
            }

            if (rule.type === 'include') {
                if (rule.start_time === null) {
                    localStart = 7 * 3600;
                } else {
                    localStart = HHMMSSToSeconds(rule.start_time);
                }

                if (rule.end_time === null) {
                    localEnd = 22 * 3600;
                } else {
                    localEnd = HHMMSSToSeconds(rule.end_time);
                }

                if (localStart !== null && localEnd !== null) {
                    for (let i = 0; i < endHourLimit; i+=3600) {
                        if (i < localStart || i >= localEnd ) {
                            if (!localDisabled.includes(i)) localDisabled.push(i);
                        }
                    }
                }

                localMaxQuantity = rule.quantity || localMaxQuantity;
                localDuration = rule.duration ? HHMMSSToSeconds(rule.duration) : localDuration;
                localInterval = rule.interval ? HHMMSSToSeconds(rule.interval) : localInterval;
            }
        });

        setDisabledHours(localDisabled);
        setStartHourLimit(localStart !== null ? localStart : 0);
        setEndHourLimit(Math.max(0, localEnd !== null ? localEnd : 0));
        setMaxQuantity(localMaxQuantity);
        setTimeDuration(localDuration);
        setTimeInterval(localInterval);
    }, [rules, currentDate, currentHour]);

    useEffect(() => {
        if (Array.isArray(cart) && cart.length >= maxQuantity) {
            setAlternateText("Finalize seu pedido");
            setRedirect(true);
        }
        else if (0 < selectedHours.length && selectedHours.length <= maxQuantity) {
            setAlternateText("Reservar");
        }
        else {
            setAlternateText("Selecione um Horário");
        }
    }, [cart, maxQuantity, selectedHours]);

    const genStart = Math.max(now.getHours() * 3600, startHourLimit);
    const genEnd = Math.min(22 * 3600, endHourLimit);
    const step = Math.max(0, (timeDuration + timeInterval));

    for(let h = genStart; h < genEnd; h += step) {
        hours.push(Math.floor(h));
    }

    const toggleSelectHour = (hourParam: number) => {
        const hour = Number(hourParam);
        if (isHourReserved(hour)) return;
        setSelectedHours(prev => {
            // if exists, remove it
            if (prev.some(h => HHMMSSToSeconds(h.start_schedule) === hour)) {
                const filtered = prev.filter(h => HHMMSSToSeconds(h.start_schedule) !== hour);
                return filtered;
            }

            const totalAlready = (Array.isArray(cart) ? cart.length : 0) + prevSelectedHours.length + prev.length;
            if (totalAlready >= maxQuantity) {
                toast.error(`Você já atingiu o limite máximo de ${maxQuantity} horários reservados.`+'\n\n'+`
                    Verifique em "Meus Agendamentos" `);
                return prev;
            }

            if (unavailableHours.includes(hour) || disabledHours.includes(hour)) {
                toast.error('Horário indisponível.');
                return prev;
            }

            const startIso = makeISODateFromSeconds(currentDate, hour);
            const endIso = makeISODateFromSeconds(currentDate, hour + timeDuration);

            const newEntry: SelectedHour = {
                owner: User?.id ?? 0,
                status: 3,
                start_schedule: startIso,
                end_schedule: endIso,
                start: startIso,
                end: endIso,
                place_id: placeId,
                price: localPrice
            };
            const newArray = [...prev, newEntry];

            return newArray;
        });
    };

    const handleReserve = async () => {
        if (!Array.isArray(selectedHours) || selectedHours.length === 0) {
            toast.info('Selecione ao menos um horário.');
            return;
        }

        // build new cart items from selectedHours and fetch place info in sequence
        const newCart: Reservation[] = [];
        for (const i of selectedHours) {
            try {
                const placeResp: any = await API_CONSUME('GET', `place/${i.place_id}`, {
                    'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': accessToken
                }, null);
                const dataInfo = placeResp?.data ?? placeResp ?? {};

                newCart.push({
                    start_schedule: i.start_schedule, // already ISO
                    end_schedule: i.end_schedule,     // already ISO
                    start: i.start,                   // ISO
                    end: i.end,                       // ISO
                    member_id: i.owner,
                    status: 3,
                    price: localPrice,
                    place_id: i.place_id,
                    place_name: dataInfo?.name ?? null,
                    place_image: dataInfo?.image ?? null
                });
            } catch (e) {
                console.warn('place fetch failed for', i.place_id, e);
                newCart.push({
                    start_schedule: i.start_schedule,
                    end_schedule: i.end_schedule,
                    start: i.start,
                    end: i.end,
                    member_id: i.owner,
                    status: 3,
                    price: localPrice,
                    place_id: i.place_id,
                    place_name: null,
                    place_image: null
                });
            }
        }


        // store reservedHours as Reservation[] with ISO strings
        setReservedHours(prev => ( [
            ...(Array.isArray(prev) ? prev : []),
            ...selectedHours.map(s => ({
                start_schedule: s.start_schedule,
                end_schedule: s.end_schedule,
                start: s.start,
                end: s.end,
                member_id: s.owner,
                status: 3,
                place_id: s.place_id,
                price: localPrice
            }))
        ]) as any);

        // Atualiza o cart usando os itens que acabamos de construir (newCart).
        // Mescla com o cart existente para não sobrescrever itens anteriores.
        if (typeof setCart === 'function') {
            setCart(prev => ([ ...(Array.isArray(prev) ? prev : []), ...newCart ]));
        }
        
        const response = API_CONSUME("POST", "schedule/", {
            'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
            'Session': accessToken
        }, newCart);

        // limpa seleção atual para evitar efeitos visuais/resubmissões
        setSelectedHours([]);
        toast.success('Horários adicionados ao carrinho com sucesso!');
    };

    const isHourInCart = (hour: number) => {
        if (!Array.isArray(cart)) return false;
        return cart.some((item: any) => {
        const ss = String(item.start_schedule || item.start || '');
        const seconds = HHMMSSToSeconds(ss);
        if (isNaN(seconds)) return false;
        return seconds === hour && Number(item.place_id ?? item.place) === Number(placeId);
        });
    };

    const isHourReserved = (hour: number) => {
        return reservedHours.some(res => {
        const ss = String(res.start_schedule || res.start || '');
        const es = String(res.end_schedule || res.end || '');
        const s = HHMMSSToSeconds(ss);
        const e = HHMMSSToSeconds(es);
        if (isNaN(s) || isNaN(e)) return false;
        return hour >= s && hour < e;
        })
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try { delete (window as any).__rendering_component; } catch (e) {}
        }
        setLocalPrice(price);
    }, [price]);

    const formatHourDisplay = (hour: number) => {
        let start = secondsToTimeString(hour);
        let end = secondsToTimeString(endHourLimit);
        if (hour + timeDuration > endHourLimit) {
          end = secondsToTimeString(endHourLimit);
        } else {
          end = secondsToTimeString(hour + timeDuration);
        }
        // if seconds are "00" show HH:MM for compact display
        const display = (t: string) => t.endsWith(':00') ? t.slice(0,5) : t;
        return window.innerWidth <= 768 ? `${display(start)} ${display(end)}` : `${display(start)} - ${display(end)}`;
    };

    return (
        <div className={styles.placeContainer}>
            <div className={styles.scheduleContainer}>
                <h1 className={styles.scheduleTitle}>Horários</h1>
                <ul className={styles.scheduleList}>
                    {hours.map((hour, index) => {
                        const isCurrentHour = hour === currentHour;
                        const isDisabled = disabledHours.includes(hour);
                        const isReserved = isHourReserved(hour);
                        const inCart = isHourInCart(hour);
                        
                        return (
                            <li
                                key={index}
                                className={`
                                    ${styles.scheduleItem}
                                    ${isDisabled ? styles.unavailableHour : ''}
                                    ${selectedHours.some(h => HHMMSSToSeconds(h.start_schedule) === hour) ? styles.selected : ''}
                                    ${isCurrentHour ? styles.currentHour : ''}
                                    ${isReserved ? styles.reserved : ''}
                                    ${inCart ? styles.inCart : ''}
                                `}
                                onClick={() => toggleSelectHour(hour)}
                            >
                                {formatHourDisplay(hour)}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className={styles.calendarContainer}>
                {(src && typeof src === 'string' && src.trim() !== '')
                    ? <Image
                        src={src}
                        width={400}
                        height={275}
                        alt="Quadra"
                        unoptimized // Remova esta linha se quiser otimização, mas pode ajudar para URLs externas
                    />
                    : <div style={{width: 400, height: 300, background: "#eee"}}>Imagem não disponível</div>
                }
                <BookingButton
                    redirect={{ redirect: redirect, pathname: 'checkout' }}
                    text={alternateText}
                    toCart={selectedHours as any}
                    onClick={handleReserve}
                />
            </div>
        </div>
    );
}

export default Schedule;