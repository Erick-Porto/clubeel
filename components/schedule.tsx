import React, { useState, useEffect } from 'react';
import styles from '@/styles/schedule.module.css';
import BookingButton from '@/components/booking-button';
import Calendar from '@/components/calendar';
import { toast } from 'react-toastify';

interface Reservation {
    hour: string;
    owner: string;
}

interface SelectedHour {
    hour: number;
    place: number;
}

interface ScheduleProps {
    reservations: Array<Reservation>;
    place: number;
}

const Schedule: React.FC<ScheduleProps> = ({ reservations, place }) => {
    const currentHour = new Date().getHours();
    const hours = [];
    const [selectedHours, setSelectedHours] = useState<SelectedHour[]>([]);
    const [prevSelectedHours, setPrevSelectedHours] = useState<SelectedHour[]>([]);
    const [cartHours, setCartHours] = useState<SelectedHour[]>([]);
    const unavailableHours = [currentHour];

    useEffect(() => {
        const cart = localStorage.getItem('___cfcsn-cart');
        if (cart) {
            setCartHours(JSON.parse(cart));
        }
    }, []);

    useEffect(() => {
        const cart = localStorage.getItem('___cfcsn-cart');
        if (cart) {
            const cartHours: SelectedHour[] = JSON.parse(cart);
            const tempPrevSelectedHours = cartHours.filter(item => item.place === place);
            setPrevSelectedHours(tempPrevSelectedHours);
        }
    }, [place]);

    for (let i = currentHour; i <= 22; i++) {
        hours.push(`${i}:00 - ${i + 1}:00`);
    }

    const isPrevSelected = (hourInt: number) => {
        return prevSelectedHours.some(h => h.hour === hourInt);
    };

    const handleSelectHour = (hour: string) => {
        const hourInt = parseInt(hour.split(':')[0]);
        if (!unavailableHours.includes(hourInt)) {
            setSelectedHours(prevSelectedHours => {
                const existingIndex = prevSelectedHours.findIndex(h => h.hour === hourInt);
                if (existingIndex !== -1) {
                    return prevSelectedHours.filter((_, index) => index !== existingIndex);
                } else {
                    const cart = localStorage.getItem('___cfcsn-cart');
                    const cartHours = cart ? JSON.parse(cart) : [];

                    if(cartHours.length==2){
                        toast.error('Você já possui 2 agendamentos não confirmados, por favor. Verifique e tente novamente');
                        return prevSelectedHours;
                    }

                    if (prevSelectedHours.length + cartHours.length < 2) {
                        return [...prevSelectedHours, { hour: hourInt, place: place }];
                    } else {
                        toast.error('Com o ultimo horário selecionado você alcançou o limite de 2 agendamentos não confirmados.');
                        return prevSelectedHours;
                    }
                }
            });
        }
    };

    const isHourReserved = (hourInt: number) => {
        return reservations.some(res => {
            const startHour = parseInt(res.hour.slice(0, 2));
            const endHour = parseInt(res.hour.slice(2, 4));
            return hourInt >= startHour && hourInt < endHour;
        });
    };

    return (
        <div className={styles.placeContainer}>
            <div className={styles.scheduleContainer}>
                <h1 className={styles.scheduleTitle}>Horários</h1>
                <ul className={styles.scheduleList}>
                    {hours.map((hour, index) => {
                        const hourInt = parseInt(hour.split(':')[0]);
                        const isCurrentHour = hourInt === currentHour;
                        const isReserved = isHourReserved(hourInt);
                        const isPreviouslySelected = isPrevSelected(hourInt);

                        return (
                            <li
                                key={index}
                                className={`
                                    ${styles.scheduleItem}
                                    ${selectedHours.some(h => h.hour === hourInt) ? styles.selected : ''}
                                    ${isCurrentHour ? styles.currentHour : ''}
                                    ${isReserved ? styles.reserved : ''}
                                    ${isPreviouslySelected ? styles.prevSelected : ''}
                                `}
                                onClick={() => handleSelectHour(hour)}
                            >
                                {hour}<br/> {isReserved ? `Reserved ` : ''}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                <Calendar/>
                <BookingButton text={"reservar"} toCart={selectedHours} />
            </div>
        </div>
    );
}

export default Schedule;