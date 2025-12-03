'use client';

import { useEffect, useState, useCallback } from 'react';
import style from '@/styles/latest-appointments.module.css';
import API_CONSUME from '@/services/api-consume';
import { useSession } from 'next-auth/react';
import { Loading } from '@/components/loading';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faClock, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

// Interfaces
interface Appointment {
    id: number;
    place_name: string;
    place_image?: string;
    start_schedule: string;
    end_schedule: string;
    price: number;
    status_id: number;
}

interface LatestAppointmentsProps {
    appointmentStatus: number; // 1 = Confirmado, 10 = Histórico, etc.
}

const LatestAppointments = ({ appointmentStatus }: LatestAppointmentsProps) => {
    const { data: session, status } = useSession();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAppointments = useCallback(async () => {
        if (status !== 'authenticated' || !session?.accessToken) return;

        try {
            setIsLoading(true);
            // Assumindo que o endpoint 'schedule/' retorna os agendamentos do usuário
            // Caso seu backend filtre por status na URL, altere para `schedule/status/${appointmentStatus}`
            const response = await API_CONSUME("GET", `schedule/member/${session.user.id}`, {
                'Session': session.accessToken
            });

            const data: Appointment[] = Array.isArray(response.schedules) ? response.schedules : (response.schedules || []);
            
            const filtered = data.filter(item => Number(item.status_id) === appointmentStatus);
            
            filtered.sort((a, b) => new Date(b.start_schedule).getTime() - new Date(a.start_schedule).getTime());
            setAppointments(filtered);
        } catch (error) {
            console.error("Erro ao buscar agendamentos:", error);
        } finally {
            setIsLoading(false);
        }
    }, [session, status, appointmentStatus]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    if (status === 'loading' || isLoading) {
        return (
            <div className={style.latestAppointmentsList}>
                <div className={style.loadingSkeleton}></div>
                <div className={style.loadingSkeleton}></div>
                <div className={style.loadingSkeleton}></div>
            </div>
        );
    }

    if (appointments.length === 0) {
        return (
            <div className={style.latestAppointmentsEmpty}>
                Nenhum agendamento encontrado nesta categoria.
            </div>
        );
    }

    return (
        <div className={style.latestAppointmentsContainer}>
            <div className={style.latestAppointmentsList}>
                {appointments.map((item) => {
                    const startDate = new Date(item.start_schedule);
                    const endDate = new Date(item.end_schedule);
                    
                    const dateStr = startDate.toLocaleDateString('pt-BR');
                    const timeStr = `${startDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
                    
                    // CORREÇÃO DO ERRO: Conversão explícita para Number
                    const price = Number(item.price);

                    return (
                        <div key={item.id} className={style.latestAppointmentsItem}>
                            <div className={style.imageContainer}>
                                <Image 
                                    src={item.place.image || '/images/placeholder.jpg'} 
                                    alt={item.place.name || 'Local'}
                                    fill
                                    className={style.latestAppointmentsItemImage}
                                />
                            </div>
                            
                            <div className={style.cardContent}>
                                <h3 className={style.latestAppointmentsItemTitle}>{item.place.name}</h3>
                                
                                <div className={style.infoRow}>
                                    <FontAwesomeIcon icon={faCalendarAlt} />
                                    <span>{dateStr}</span>
                                </div>
                                
                                <div className={style.infoRow}>
                                    <FontAwesomeIcon icon={faClock} />
                                    <span>{timeStr}</span>
                                </div>

                                <div className={style.priceTag}>
                                    R$ {isNaN(price) ? '0.00' : price.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LatestAppointments;