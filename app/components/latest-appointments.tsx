'use client';

import React, { useEffect, useState } from 'react';
import style from '@/styles/latest-appointments.module.css';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import API_CONSUME from '@/services/api-consume';
import { useUser } from '@/context/UserContext';
import {Loading} from '@/components/loading';
const LatestAppointments: React.FC = () => {
    const { User, accessToken } = useUser();
    const [appointments, setAppointments] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!User?.id || !accessToken) {
            return;
        }

        let mounted = true;
        const fetchAppointments = async () => {
            setLoading(true);
            setError(null);
            try {
                const response: any = await API_CONSUME("GET", `schedule/member/${User.id}`, {
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
                    'Session': accessToken
                }, null);
                const schedulesRaw = Array.isArray(response?.schedules) ? response.schedules : [];
                // manter apenas schedules com status === '1'
                const schedules = schedulesRaw.filter((s: any) => String(s.status) === '1');

                // busca dados do place para cada schedule em paralelo
                const enriched = await Promise.all(schedules.map(async (s: any) => {
                    const placeId = s.place_id ?? s.place ?? null;
                    if (!placeId) return s;
                    try {
                        const placeResp: any = await API_CONSUME("GET", `place/${placeId}`, {
                            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
                            'Session': accessToken
                        }, null);
                        const data = placeResp?.data ?? placeResp ?? {};
                        return {
                            ...s,
                            place_name: s.place_name ?? data?.name ?? s.place_name,
                            place_image: s.place_image ?? data?.image ?? s.place_image
                        };
                    } catch (err) {
                        // se falhar, retorna schedule original
                        console.warn('Failed to fetch place for', placeId, err);
                        return s;
                    }
                }));

                if (mounted) setAppointments(enriched);
            } catch (e: any) {
                if (mounted) {
                    setError('Erro ao carregar agendamentos.');
                    setAppointments([]);
                    console.error('Failed to fetch appointments', e);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchAppointments();
        return () => { mounted = false; };
    }, [User?.id, accessToken]);

    return (
        <div className={style.latestAppointmentsContainer}>
            <h1 className={style.latestAppointmentsContainerTitle}>
                <FontAwesomeIcon icon={faCalendarDays} />
                Últimos agendamentos
            </h1>

            {loading && (
                <div className={style.latestAppointmentsEmpty}>
                    <Loading/>
                </div>
            )}

            {!loading && error && (
                <div className={style.latestAppointmentsEmpty}>
                    <h2>{error}</h2>
                </div>
            )}

            {!loading && !error && Array.isArray(appointments) && appointments.length === 0 && (
                <div className={style.latestAppointmentsEmpty}>
                    <h2>Nenhum agendamento encontrado.</h2>
                </div>
            )}

            {!loading && !error && Array.isArray(appointments) && appointments.length > 0 && (
                <ul className={style.latestAppointmentsList}>
                    {appointments.map((a, idx) => {
                        const start = a.start_schedule || a.start || a.start_date || '';
                        const end = a.end_schedule || a.end || a.end_date || '';
                        const placeName = a.place_name || a.place?.name || a.place || 'Local desconhecido';
                        const startDisplay = start ? new Date(start.replace(' ', 'T')).toLocaleString() : '';
                        const endDisplay = end ? new Date(end.replace(' ', 'T')).toLocaleString() : '';
                        return (
                            <li key={idx} className={style.latestAppointmentsItem}>
                                <div className={style.latestAppointmentsItemTitle}>
                                    {placeName}
                                </div>
                                {a.place_image && (
                                    <img src={a.place_image} alt={placeName} style={{width:60, height:60, objectFit:'cover', borderRadius:4}} />
                                )}
                                <div className={style.latestAppointmentsItemTime}>
                                    {startDisplay}{endDisplay ? ` — ${endDisplay}` : ''}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default LatestAppointments;