"use client";

import style from "../../../styles/social.module.css";
import { stageTone } from "../../../utils/social";

const TONE_CLASS = {
    pending: style.badgePending,
    action: style.badgeAction,
    ok: style.badgeOk,
    muted: style.badgeMuted,
};

/** Selo do estágio. O texto é o `stage_label` da Lara; só a cor sai do `stage`. */
export default function SocialStageBadge({ stage, label }: { stage: string; label: string }) {
    return <span className={`${style.badge} ${TONE_CLASS[stageTone(stage)]}`}>{label || stage}</span>;
}
