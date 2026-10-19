"use client";

import { faBan, faCircleCheck, faClock, faCreditCard, faXmark } from "@fortawesome/free-solid-svg-icons";
import { stageTone } from "../../../utils/social";
import { Pill, type PillKind } from "../UI/ui";

const TONE = {
    pending: { kind: "warn", icon: faClock },
    action: { kind: "warn", icon: faCreditCard },
    ok: { kind: "ok", icon: faCircleCheck },
    danger: { kind: "danger", icon: faXmark },
    muted: { kind: "off", icon: faBan },
} as const satisfies Record<ReturnType<typeof stageTone>, { kind: PillKind; icon: unknown }>;

/** Selo do estágio. O texto é o `stage_label` da Lara; só a cor e o ícone saem do `stage`. */
export default function SocialStageBadge({ stage, label }: { stage: string; label: string }) {
    const tone = TONE[stageTone(stage)];
    return (
        <Pill kind={tone.kind} icon={tone.icon}>
            {label || stage}
        </Pill>
    );
}
