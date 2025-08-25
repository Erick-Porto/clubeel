'use client';

import style from '@/styles/latest-appointments.module.css';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const LatestAppointments = () => {
    return(
    <div className={style.latestAppointmentsContainer}>
        <h1 className={style.latestAppointmentsContainerTitle}>
                <FontAwesomeIcon icon={faCalendarDays} />
                Últimos agendamentos
        </h1>
        <div className={style.latestAppointmentsEmpty}>
            <h1>
                Nenhum agendamento encontrado.
            </h1>
        </div>
    </div>
)}

export default LatestAppointments;