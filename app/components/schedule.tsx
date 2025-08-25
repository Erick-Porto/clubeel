'use client'

import React, { useState, useEffect } from 'react';
import styles from '@/styles/schedule.module.css';
import BookingButton from '@/components/booking-button';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useUser } from '@/context/UserContext';

interface Reservation {
    hour: string;
    owner: string;
}

interface SelectedHour {
    hour: string; // agora é "HH:mm:ss"
    place: number;
}

interface ScheduleProps {
    reservations: Array<Reservation>;
    place: number;
    src: string;
    rules?: any[]; // Adiciona a prop rules
}

// Funções utilitárias para conversão
function secondsToHHMMSS(seconds: number) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function HHMMSSToSeconds(hms: string) {
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
}

const Schedule: React.FC<ScheduleProps> = ({ reservations, place, src, rules = [] }) => {
    const { cart, setCart } = useUser();
    const currentDate = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const now = new Date();
    const currentHour = now.getHours();
    const currentHourSeconds = currentHour * 3600;
    const hours: number[] = [];
    const [selectedHours, setSelectedHours] = useState<SelectedHour[]>([]);
    const [prevSelectedHours, setPrevSelectedHours] = useState<SelectedHour[]>([]);
    const [redirect, setRedirect] = useState(false);
    const unavailableHours = [currentHourSeconds];
    const disabledHours: number[] = [];
    const [maxQuantity, setMaxQuantity] = useState(2);
    const [timeInterval, setTimeInterval] = useState(0); // segundos
    const [timeDuration, setTimeDuration] = useState(3600); // padrão 1h em segundos
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(79200); // até 22h em segundos

    useEffect(() => {
        if (cart) {
            const tempPrevSelectedHours = cart.filter(item => item.place === place);
            setPrevSelectedHours(tempPrevSelectedHours);
        }
    }, [place, cart]);

    useEffect(() => {
        // Verifica se dois horários estão reservados e ativa o redirecionamento
        if (prevSelectedHours.length >= 2) {
            setRedirect(true);
        } else {
            setRedirect(false);
        }
    }, [prevSelectedHours]);

    console.log('... ',rules);


    let ruleIsValid = false;
    
    rules.forEach(rule => {
        if(rule.start_date===null && rule.end_date===null) ruleIsValid = true
        
        if(currentDate >= rule.start_date && currentDate <= rule.end_date) ruleIsValid = true;
        
        if(ruleIsValid && rule.type === 'exclude'){
            if(rule.start_time && rule.end_time){
                // Adiciona todos os horários no intervalo como desabilitados
                let start = HHMMSSToSeconds(rule.start_time);
                let end = HHMMSSToSeconds(rule.end_time);
                for (let i = start; i < end; i += 3600) {
                    if(i !== currentHourSeconds && !disabledHours.includes(i)) disabledHours.push(i);
                }
            }
        }

        if(ruleIsValid && rule.type === 'include'){
            if(rule.start_time && rule.end_time) {
                let start = HHMMSSToSeconds(rule.start_time);
                setStartTime(start);
                let end = HHMMSSToSeconds(rule.end_time);
                setEndTime(end);
                for (let i = 0; i < 24 * 3600; i += 3600) {
                    if(i < start || i >= end) {
                        if(!disabledHours.includes(i)) disabledHours.push(i);
                    }
                }
            }

            const quantity = rule.quantity || 2;
            if(quantity !== maxQuantity) setMaxQuantity(quantity);

            const duration = rule.duration ? HHMMSSToSeconds(rule.duration) : 3600;
            if(duration !== timeDuration) setTimeDuration(duration);

            const interval = rule.interval ? HHMMSSToSeconds(rule.interval) : 0;
            if(interval !== timeInterval) setTimeInterval(interval);
        }
    });

    // Gera os horários em segundos (de hora atual até 22h)
    for (let i = now.getHours() * 3600; i <= endTime; i += 3600) {
        hours.push(i);
    };

    const isPrevSelected = (hourSeconds: number) => {
        return prevSelectedHours.some(h => HHMMSSToSeconds(h.hour) === hourSeconds);
    };

    const formatHourDisplay = (hourSeconds: number) => {
        let p = 0;
        const start = secondsToHHMMSS(hourSeconds+p).slice(0,5);
        const end = secondsToHHMMSS(HHMMSSToSeconds(start) + timeDuration).slice(0,5);
        p = HHMMSSToSeconds(end)+timeInterval;
        return window.innerWidth <= 768
            ? `${start} ${end}`
            : `${start} - ${end}`;
    };

    const handleSelectHour = (hourSeconds: number) => {
        const totalSelectedAndReserved = prevSelectedHours.length + selectedHours.length;

        // Permitir remoção de um horário selecionado
        if (selectedHours.some(h => HHMMSSToSeconds(h.hour) === hourSeconds)) {
            setSelectedHours(prevSelectedHours =>
                prevSelectedHours.filter(h => HHMMSSToSeconds(h.hour) !== hourSeconds)
            );
            return;
        }

        // Impedir seleção de novos horários se o limite for atingido
        if (totalSelectedAndReserved >= maxQuantity) {
            toast.error(`Você já atingiu o limite máximo de ${maxQuantity} horários.`);
            return;
        }

        if (!unavailableHours.includes(hourSeconds) && !disabledHours.includes(hourSeconds)) {
            setSelectedHours(prevSelectedHours => [
                ...prevSelectedHours,
                { hour: secondsToHHMMSS(hourSeconds), place }
            ]);
        }
    };

    const handleReserve = () => {
        const updatedCart = [...cart, ...selectedHours];
        setCart(updatedCart); // Atualiza o carrinho no contexto
        setPrevSelectedHours([...prevSelectedHours, ...selectedHours]); // Atualiza os horários previamente selecionados
        setSelectedHours([]); // Limpa os horários selecionados localmente
        toast.success('Horários adicionados ao carrinho com sucesso!');
    };

    const isHourReserved = (hourSeconds: number) => {
        return reservations.some(res => {
            const startHour = HHMMSSToSeconds(res.hour.slice(0, 5) + ':00');
            const endHour = HHMMSSToSeconds(res.hour.slice(2, 4) + ':00:00');
            return hourSeconds >= startHour && hourSeconds < endHour;
        });
    };

    // Processa regras do tipo interval
    const intervalRules = rules
        .map(rule => {
            try {
                return typeof rule === 'string' ? JSON.parse(rule) : rule;
            } catch {
                return null;
            }
        })
        .filter(rule => rule && rule.name === 'interval');

    return (
        <div className={styles.placeContainer}>
            {intervalRules.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <b>Regras de Intervalo:</b>
                    <ul>
                        {intervalRules.map((rule, idx) => (
                            <li key={idx}>
                                Início: {rule.start_time} | Fim: {rule.end_time} | Quantidade: {rule.quantity}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className={styles.scheduleContainer}>
                <h1 className={styles.scheduleTitle}>Horários</h1>
                <ul className={styles.scheduleList}>
                    {hours.map((hourSeconds, index) => {
                        const isCurrentHour = hourSeconds === currentHourSeconds;
                        const isDisabled = disabledHours.includes(hourSeconds);
                        const isReserved = isHourReserved(hourSeconds);
                        const isPreviouslySelected = isPrevSelected(hourSeconds);

                        return (
                            <li
                                key={index}
                                className={`
                                    ${styles.scheduleItem}
                                    ${isDisabled ? styles.unavailableHour : ''}
                                    ${selectedHours.some(h => HHMMSSToSeconds(h.hour) === hourSeconds) ? styles.selected : ''}
                                    ${isCurrentHour ? styles.currentHour : ''}
                                    ${isReserved || isPreviouslySelected ? styles.reserved : ''}
                                `}
                                onClick={() => handleSelectHour(hourSeconds)}
                            >
                                {formatHourDisplay(hourSeconds)}
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
                    text={redirect ? "Finalizar reserva" : "Reservar"}
                    toCart={selectedHours}
                    onClick={handleReserve}
                />
            </div>
        </div>
    );
}

export default Schedule;