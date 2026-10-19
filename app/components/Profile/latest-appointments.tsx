'use client';
import { useEffect, useState, useCallback } from 'react';
import style from '../../../styles/latest-appointments.module.css';
import API_CONSUME from '../../../services/api-consume';
import { useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faCircleCheck, faClock, faChevronDown, faChevronUp, faCircleInfo, faTableTennisPaddleBall } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { Media, Pill } from '../UI/ui';

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
        if (status !== 'authenticated' || !session?.accessToken || !session?.user?.id) {
            toast.error("Sessão inválida. Por favor, faça login novamente.");
            return;
        }
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

    const tooltipBox = tooltip ? (
        <div className={style.tooltipAlert}>
            <FontAwesomeIcon icon={faCircleInfo} />
            <span className={style.tooltipText}>{tooltip}</span>
        </div>
    ) : null;

    if (status === 'loading' || isLoading) {
        return (
            <div className={style.latestAppointmentsList} aria-busy="true">
                <div className={style.loadingSkeleton}></div>
                <div className={style.loadingSkeleton}></div>
            </div>
        );
    }

    if (appointments.length === 0) {
        return (
            <div className={style.latestAppointmentsContainer}>
                {tooltipBox}
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
            {tooltipBox}

            <div className={style.latestAppointmentsList}>
                {visibleAppointments.map((item) => {
                    const startDate = new Date(item.start_schedule);
                    const endDate = new Date(item.end_schedule);
                    const dateStr = startDate.toLocaleDateString('pt-BR');
                    const timeStr = `${startDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} – ${endDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
                    const price = Number(item.price);
                    const placeName = item.place.name || 'Local';

                    return (
                        <div key={item.id} className={style.latestAppointmentsItem}>
                            <Media
                                src={item.place.image || null}
                                area="quadras"
                                icon={faTableTennisPaddleBall}
                                alt={placeName}
                                className={style.imageContainer}
                            />

                            <div className={style.cardContent}>
                                <div className={style.cardTop}>
                                    <h3 className={style.latestAppointmentsItemTitle}>{placeName}</h3>
                                    {appointmentStatus === 1 && <Pill kind="ok" icon={faCircleCheck}>Confirmado</Pill>}
                                </div>
                                <div className={style.infoRow}>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{dateStr}</span>
                                </div>
                                <div className={style.infoRow}>
                                    <FontAwesomeIcon icon={faClock} />
                                    <span>{timeStr}</span>
                                </div>
                                <div className={style.priceTag}>
                                    {(isNaN(price) ? 0 : price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                            <>Ver mais ({appointments.length - initialLimit}) <FontAwesomeIcon icon={faChevronDown} /></>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default LatestAppointments;
