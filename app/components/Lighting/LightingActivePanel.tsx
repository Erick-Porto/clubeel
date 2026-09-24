"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faRotateRight, faUserGroup } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/lighting.module.css";
import DurationStepper, { useDurationChoice } from "./DurationStepper";
import {
    fetchActivationPlace,
    type LightingAvailability,
    type LightingPlace,
} from "../../../services/lighting-api";
import {
    describeWindow,
    durationOptions,
    expectedLitUntil,
    formatClock,
    formatCountdown,
    formatDuration,
    parseInstant,
} from "../../../utils/lighting";

interface LightingActivePanelProps {
    availability: LightingAvailability;
    serverNow: number;
    /** Um POST em andamento: todos os botões de ação ficam travados. */
    pending: boolean;
    onExtend: (minutes: number) => void;
    onRelease: () => void;
}

type PlaceLookup =
    | { state: "loading" }
    | { state: "found"; place: LightingPlace }
    /** Grupo ou quadra fora da lista (ou a leitura falhou): o seletor usa o teto. */
    | { state: "missing" };

/** Diferença abaixo disso é arredondamento, não "outro sócio prolongou". */
const SAME_INSTANT_MS = 60_000;

/**
 * Estado "acesa" — o que o sócio abre o app para ver.
 *
 * O número grande é `lit_until` (da QUADRA, somando todos os sócios), não o
 * `ends_at` do acionamento dele: usar `ends_at` anunciaria um apagão que não
 * vai acontecer quando outra pessoa prolongou.
 */
export default function LightingActivePanel({
    availability,
    serverNow,
    pending,
    onExtend,
    onRelease,
}: LightingActivePanelProps) {
    const activation = availability.activation!;
    const [confirmRelease, setConfirmRelease] = useState(false);

    // O máximo do "Prolongar" é o `available_minutes` DA QUADRA, que só a lista
    // de quadras traz. Relida junto com a disponibilidade.
    const [placeLookup, setPlaceLookup] = useState<PlaceLookup>({ state: "loading" });
    const groupHint = useRef<number | null>(null);
    const lookupKey = `${activation.place_id}|${activation.place_group}`;
    const lastKey = useRef(lookupKey);

    useEffect(() => {
        if (lastKey.current !== lookupKey) {
            lastKey.current = lookupKey;
            groupHint.current = null;
            setPlaceLookup({ state: "loading" });
        }

        let cancelled = false;
        fetchActivationPlace(activation, groupHint.current).then((result) => {
            if (cancelled) return;
            if (result.ok && result.data) {
                groupHint.current = result.data.groupId;
                setPlaceLookup({ state: "found", place: result.data.place });
            } else if (result.ok) {
                setPlaceLookup({ state: "missing" });
            } else {
                // Falha passageira: mantém o que já se sabia.
                setPlaceLookup((current) => (current.state === "loading" ? { state: "missing" } : current));
            }
        });
        return () => {
            cancelled = true;
        };
        // `availability.now` muda a cada leitura: é o gatilho da releitura da quadra.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lookupKey, availability.now]);

    const place = placeLookup.state === "found" ? placeLookup.place : null;
    const options =
        placeLookup.state === "loading"
            ? []
            : place
              ? place.open
                  ? durationOptions(availability.min_minutes, availability.step_minutes, place.available_minutes)
                  : []
              : // Sem a quadra na lista, o limite conhecido é o teto; o servidor apara no fechamento.
                durationOptions(availability.min_minutes, availability.step_minutes, availability.max_minutes);
    const [minutes, setMinutes] = useDurationChoice(options);

    const litUntil = activation.lit_until ?? activation.ends_at;
    const litUntilMs = parseInstant(litUntil);
    const endsAtMs = parseInstant(activation.ends_at);
    const remainingMs = litUntilMs - serverNow;
    const counting = !Number.isNaN(litUntilMs) && remainingMs > 0;

    // Outro sócio prolongou: a luz vai além do acionamento deste sócio.
    const extendedByOthers =
        !Number.isNaN(endsAtMs) && !Number.isNaN(litUntilMs) && litUntilMs - endsAtMs > SAME_INSTANT_MS;
    const ownStillRunning = !Number.isNaN(endsAtMs) && endsAtMs > serverNow;
    const extendLightUntil = expectedLitUntil(activation.lit_until, serverNow, minutes);

    return (
        <section className={style.activePanel} aria-live="polite">
            <div className={style.activeHero}>
                <span className={style.activeKicker}>
                    <FontAwesomeIcon icon={faLightbulb} /> Luz acesa
                </span>
                <p className={style.activePlace}>
                    {activation.place_group ? `${activation.place_group} · ` : ""}
                    <strong>{activation.place_name}</strong>
                </p>

                <p className={style.activeUntilLabel}>a luz vai até</p>
                <p className={style.activeUntil}>{formatClock(litUntil)}</p>

                <p className={style.activeCountdown}>
                    {counting ? (
                        <>apaga em {formatCountdown(remainingMs)}</>
                    ) : (
                        <>
                            <FontAwesomeIcon icon={faRotateRight} spin /> conferindo com o clube…
                        </>
                    )}
                </p>
            </div>

            {extendedByOthers && (
                <p className={style.activeShared}>
                    <FontAwesomeIcon icon={faUserGroup} />
                    <span>
                        {ownStillRunning ? (
                            <>
                                Seu acionamento vai até <strong>{formatClock(activation.ends_at)}</strong>, mas
                                outro sócio prolongou a luz até <strong>{formatClock(litUntil)}</strong>.
                            </>
                        ) : (
                            <>
                                Outro sócio prolongou a luz até <strong>{formatClock(litUntil)}</strong>.
                            </>
                        )}
                    </span>
                </p>
            )}

            <div className={style.activeInfo}>
                <p>
                    <strong>A luz não é de ninguém.</strong> Quando o prazo acabar, qualquer sócio presente
                    pode acionar de novo e a luz continua acesa, sem piscar.
                </p>
                <p>
                    Acender não reserva a quadra: quem chegar primeiro joga.
                </p>
                <p className={style.activeInfoMuted}>
                    A luz não depende do seu login: se a sua sessão expirar, ela continua acesa até{" "}
                    {formatClock(litUntil)}.
                </p>
            </div>

            <div className={style.actionBlock}>
                <h2 className={style.actionTitle}>Prolongar</h2>
                {placeLookup.state === "loading" ? (
                    <p className={style.actionHint}>
                        <FontAwesomeIcon icon={faRotateRight} spin /> Conferindo o horário da quadra…
                    </p>
                ) : options.length > 0 ? (
                    <>
                        <p className={style.actionHint}>
                            {extendLightUntil > serverNow + minutes * 60_000 ? (
                                <>
                                    Conta a partir de agora: pedir {formatDuration(minutes)} leva o seu acionamento
                                    até cerca de {formatClock(serverNow + minutes * 60_000)}. A luz já vai até{" "}
                                    <strong>{formatClock(extendLightUntil)}</strong> e não apaga antes disso.
                                </>
                            ) : (
                                <>
                                    Conta a partir de agora: pedir {formatDuration(minutes)} deixa a luz acesa até
                                    cerca de <strong>{formatClock(extendLightUntil)}</strong>.
                                </>
                            )}
                            {!place && <> Perto do fechamento, o clube pode conceder menos.</>}
                        </p>
                        <DurationStepper
                            options={options}
                            value={minutes}
                            onChange={setMinutes}
                            disabled={pending}
                        />
                        <button
                            type="button"
                            className={style.primaryButton}
                            onClick={() => onExtend(minutes)}
                            disabled={pending}
                        >
                            {pending ? "Enviando…" : `Prolongar por ${formatDuration(minutes)}`}
                        </button>
                    </>
                ) : (
                    <p className={style.actionHint}>
                        {place && !place.open
                            ? "Esta quadra está fora do horário agora, então não dá mais para prolongar."
                            : "O horário desta quadra está terminando, então não dá mais para prolongar."}
                        {place?.next_window && (
                            <>
                                {" "}
                                O próximo dela é <strong>{describeWindow(place.next_window, availability.now)}</strong>.
                            </>
                        )}
                    </p>
                )}
            </div>

            <div className={style.actionBlock}>
                <h2 className={style.actionTitle}>Terminou antes?</h2>
                {confirmRelease ? (
                    <div className={style.confirmBox}>
                        <p>
                            Devolver a <strong>{activation.place_name}</strong>? Você fica livre para acender outra
                            quadra. Se outro sócio prolongou, a luz continua acesa até o prazo dele.
                        </p>
                        <div className={style.confirmActions}>
                            <button
                                type="button"
                                className={style.dangerButton}
                                onClick={() => {
                                    setConfirmRelease(false);
                                    onRelease();
                                }}
                                disabled={pending}
                            >
                                Sim, devolver
                            </button>
                            <button
                                type="button"
                                className={style.secondaryButton}
                                onClick={() => setConfirmRelease(false)}
                                disabled={pending}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={style.secondaryButton}
                        onClick={() => setConfirmRelease(true)}
                        disabled={pending}
                    >
                        Devolver a quadra
                    </button>
                )}
            </div>
        </section>
    );
}
