import React, { useState, useEffect } from 'react';
import style from '@/styles/calendar.module.css'; // Importar o arquivo CSS

const Calendar: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDate(new Date());
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const generateCalendar = () => {
        const calendar = [];
        let day = 1;

        for (let i = 0; i < 6; i++) {
            const week = [];
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDayOfMonth) {
                    week.push(<td key={j} className={style.calendarEmpty}></td>);
                } else if (day > daysInMonth) {
                    week.push(<td key={j} className={style.calendarEmpty}></td>);
                } else {
                    const isToday = day === currentDate.getDate();
                    const isPast = day < currentDate.getDate();
                    week.push(
                        <td key={j} className={isToday ? style.calendarToday : isPast ? style.calendaPast : ''}>
                            {day}
                        </td>
                    );
                    day++;
                }
            }
            calendar.push(<tr key={i}>{week}</tr>);
        }
        return calendar;
    };

    const monthYearTitle = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <div className={style.calendarContainer}>
            <h2 className={style.calendarTitle}>{monthYearTitle}</h2>
            <table className={style.calendar}>
                <thead>
                    <tr>
                        {daysOfWeek.map((day, index) => (
                            <th key={index} className={style.calendarHeader}>{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {generateCalendar()}
                </tbody>
            </table>
        </div>
    );
};

export default Calendar;
