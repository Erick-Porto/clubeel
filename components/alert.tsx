"use client"

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import styles from '@/styles/alertbox.module.css';

interface AlertProps {
    visible: boolean;
    width: number;
    title: string;
    message: string;
}

const Alert: React.FC<AlertProps> = ({ visible, width, title, message }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        const id = setTimeout(() => setIsVisible(visible), 500); // Add a 500ms timeout
        setTimeoutId(id);
    }, [visible]);

    useEffect(() => {
        const alertElement = document.getElementById("alert");
        if (alertElement) {
            alertElement.style.display = isVisible ? "block" : "none";
        }
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => setIsVisible(true), 300); // Reset visibility state after closing
    };

    return (
        <div id="alert" className={styles.alertContainer}>
            <div className={styles.background} onClick={handleClose}></div>
            <div className={styles.alert} style={{ width: `${width}%` }}>
                <div className={styles.alertHeader}>
                    <h3 className={styles.alertTitle}>
                        {title}
                    </h3>
                    <FontAwesomeIcon className={styles.alertClose} icon={faXmark} onClick={handleClose} />
                </div>
                <div className={styles.alertBody}>
                    {message}
                </div>
            </div>
        </div>
    );
};

export default Alert;