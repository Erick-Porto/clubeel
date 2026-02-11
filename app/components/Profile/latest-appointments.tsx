'use client';
import { useEffect, useState, useCallback } from 'react';
import style from '@/styles/latest-appointments.module.css';
import API_CONSUME from '@/services/api-consume';
import { signOut, useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faClock, faChevronDown, faChevronUp, faInfoCircle } from '@fortawesome/free-solid-svg-icons'; 
import Image from 'next/image';
import { toast } from 'react-toastify';

interface Place {
    name?: string;
    image?: string;
}

interface Appointment {
    id: number;
    place_id?: number;
    place: Place;
    place_name?: string;
    place_image?: string;
    start_schedule: string;
    end_schedule: string;
    price: number;
    status_id: number;
}

interface LatestAppointmentsProps {
    appointmentStatus: number;
    initialLimit?: number;
    tooltip?: React.ReactNode | null;
}

interface CustomSession {
    user?: {
        id?: string | number;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    accessToken?: string;
}

const LatestAppointments = ({ appointmentStatus, initialLimit = 4, tooltip }: LatestAppointmentsProps) => {
    const { data: sessionData, status } = useSession();
    const session = sessionData as CustomSession | null;

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isExpanded, setIsExpanded] = useState(false);

    const fetchAppointments = useCallback(async () => {
        if (status !== 'authenticated' || !session?.accessToken || !session?.user?.id) 
            return toast.error("Sessão inválida. Por favor, faça login novamente.");
            // signOut({ callbackUrl: '/login' });;

        try {
            setIsLoading(true);
            
            const response = await API_CONSUME("GET", `schedule/member/${session.user.id}`);

            if (!response.ok || !response.data) {
                const msg = response.message as unknown;
                const errorMessage = msg instanceof Error ? msg.message : String(msg);
                toast.error("Erro ao buscar agendamentos: " + errorMessage);
                return;
            }

            const rawData = response.data;
            const data: Appointment[] = Array.isArray(rawData.schedules) ? rawData.schedules : [];
            
            const filtered = data.filter(item => Number(item.status_id) === appointmentStatus);
            
            filtered.sort((a, b) => new Date(b.start_schedule).getTime() - new Date(a.start_schedule).getTime());
            
            setAppointments(filtered);

        } catch (error) {
            toast.error("Erro crítico na execução: " + (error instanceof Error ? error.message : String(error)));
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
            <div className={style.latestAppointmentsContainer}>
                {tooltip && (
                    <div className={style.tooltipAlert}>
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span>{tooltip}</span>
                    </div>
                )}
                <div className={style.latestAppointmentsEmpty}>
                    Nenhum agendamento encontrado nesta categoria.
                </div>
            </div>
        );
    }

    const visibleAppointments = isExpanded ? appointments : appointments.slice(0, initialLimit);
    const hasMore = appointments.length > initialLimit;

    return (
        <div className={style.latestAppointmentsContainer}>
            
            {tooltip && (
                <div className={style.tooltipAlert}>
                    <div className={style.tooltipIconWrapper}>
                        <FontAwesomeIcon icon={faInfoCircle} />
                    </div>
                    <span className={style.tooltipText}>{tooltip}</span>
                </div>
            )}

            <div className={style.latestAppointmentsList}>
                {visibleAppointments.map((item) => {
                    const startDate = new Date(item.start_schedule);
                    const endDate = new Date(item.end_schedule);
                    const dateStr = startDate.toLocaleDateString('pt-BR');
                    const timeStr = `${startDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
                    const price = Number(item.price);
                    const placeName = item.place.name || 'Local';
                    const placeImage = item.place.image || `https://placehold.co/400x300/fff/cecece?font=montserrat&text=${placeName}`;

                    return (
                        <div key={item.id} className={style.latestAppointmentsItem}>
                            <div className={style.imageContainer}>
                                <Image 
                                    src={placeImage} 
                                    alt={placeName}
                                    priority={true}
                                    quality={100}
                                    className={style.latestAppointmentsItemImage}
                                    fill
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

            {hasMore && (
                <div className={style.showMoreContainer}>
                    <button 
                        className={style.showMoreButton} 
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <>Ver menos <FontAwesomeIcon icon={faChevronUp} /></>
                        ) : (
                            <>Ver mais agendamentos ({appointments.length - initialLimit} restantes) <FontAwesomeIcon icon={faChevronDown} /></>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default LatestAppointments;