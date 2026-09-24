"use client";

import { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import style from "../../../styles/replay.module.css";

interface ReplayNoticeProps {
    icon: IconDefinition;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    tone?: "neutral" | "alert";
}

/**
 * Estado vazio / de erro da área de replay. Existe como componente porque as
 * três telas precisam dizer a mesma coisa nas mesmas situações: não há vídeo,
 * o vídeo expirou, a sessão caiu, a API não respondeu.
 */
export default function ReplayNotice({
    icon,
    title,
    description,
    action,
    tone = "neutral",
}: ReplayNoticeProps) {
    return (
        <div className={`${style.notice} ${tone === "alert" ? style.noticeAlert : ""}`}>
            <FontAwesomeIcon icon={icon} className={style.noticeIcon} />
            <h3 className={style.noticeTitle}>{title}</h3>
            {description && <p className={style.noticeText}>{description}</p>}
            {action && <div className={style.noticeAction}>{action}</div>}
        </div>
    );
}
