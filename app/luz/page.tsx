"use client";

/**
 * Luz da quadra: o sócio acende a luz pelo celular nos horários em que o clube
 * aceita (o uso livre, quando não há reserva). Cada quadra tem o próprio horário.
 *
 * Esta tela não decide nada. Se pode acender, em qual quadra e por quanto tempo
 * é resposta da Lara; aqui só se renderiza o que ela disse:
 *
 *   activation preenchida      → estado 3, "acesa"
 *   open (alguma quadra aberta)→ estado 2, esporte → quadra → tempo
 *   senão                      → estado 1, "fechado", com a próxima abertura
 *
 * Depois de cada ação a disponibilidade é relida — nunca se monta "aceso" a
 * partir da resposta do POST. Recusas escolhem o comportamento pelo `reason` e
 * exibem o `error` que a Lara mandou.
 */

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faRotateRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import replayStyle from "../../styles/replay.module.css";
import style from "../../styles/lighting.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading, LoadingScreen } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import LightingClosed from "../components/Lighting/LightingClosed";
import LightingPicker from "../components/Lighting/LightingPicker";
import LightingActivePanel from "../components/Lighting/LightingActivePanel";
import { useLightingAvailability } from "../hooks/useLightingAvailability";
import {
    activatePlace,
    releaseActivation,
    toWindow,
    type LightingFailure,
    type LightingPlace,
} from "../../services/lighting-api";
import {
    describeWindow,
    formatClock,
    formatDuration,
    parseInstant,
    windowOccasion,
} from "../../utils/lighting";

interface Flash {
    tone: "neutral" | "alert";
    title: string;
    text: string;
}

export default function LightingPage() {
    const { status } = useSession();
    const { data, loading, error, serverNow, reload } = useLightingAvailability();

    const [pending, setPending] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);
    // Trava síncrona: dois toques antes do re-render não viram dois POSTs.
    const busy = useRef(false);

    // O `next_window` de uma recusa é o DA QUADRA recusada. Sem ele, não se
    // completa com o `next_window` geral: seria o horário de outra quadra.
    const nextWindowSentence = useCallback(
        (raw: unknown) => {
            const window = toWindow(raw);
            if (!window) return "";
            const occasion = windowOccasion(window);
            return ` Próximo horário desta quadra: ${describeWindow(window, data?.now ?? "")}${occasion ? ` — ${occasion}` : ""}.`;
        },
        [data]
    );

    /**
     * Uma recusa, tratada pelo `reason`. Quase nenhuma é culpa do sócio: o tom é
     * de informação, e o texto é o `error` que a Lara já escreveu para ele.
     */
    const handleRefusal = useCallback(
        async (failure: LightingFailure) => {
            switch (failure.kind) {
                case "unauthorized":
                    return; // o interceptor já levou ao login
                case "throttled":
                    toast.warning(failure.error);
                    return;
                case "network":
                    toast.error(failure.error);
                    return;
                case "server":
                    // 5xx já vira toast no API_CONSUME.
                    if (failure.status < 500) toast.error(failure.error);
                    await reload();
                    return;
                case "validation":
                    setFlash({ tone: "alert", title: "Não deu para acender", text: failure.error });
                    await reload();
                    return;
            }

            const extras = failure.extras;
            switch (failure.reason) {
                case "window_closed":
                    setFlash({
                        tone: "neutral",
                        title: "Esta quadra está fora do horário",
                        text: failure.error + nextWindowSentence(extras.next_window),
                    });
                    break;
                case "window_ending":
                    setFlash({
                        tone: "neutral",
                        title: "O horário desta quadra está terminando",
                        text: failure.error + nextWindowSentence(extras.next_window),
                    });
                    break;
                case "member_limit":
                    // Ele já está em outra quadra: a releitura leva ao estado "acesa".
                    setFlash({ tone: "neutral", title: "Você já tem uma quadra acesa", text: failure.error });
                    break;
                case "place_reserved": {
                    const from = extras.reserved_from ? formatClock(String(extras.reserved_from)) : null;
                    const until = extras.reserved_until ? formatClock(String(extras.reserved_until)) : null;
                    const period = from && until ? ` Reservada das ${from} às ${until}.` : "";
                    setFlash({
                        tone: "neutral",
                        title: "Essa quadra está reservada",
                        text: `${failure.error}${period} A luz dela acende sozinha no horário da reserva. Escolha outra quadra.`,
                    });
                    break;
                }
                case "place_not_eligible":
                    setFlash({ tone: "neutral", title: "Essa quadra saiu da lista", text: failure.error });
                    break;
                case "no_activation":
                    // O front estava velho: relê em silêncio.
                    break;
                default:
                    setFlash({ tone: "alert", title: "Não deu certo", text: failure.error });
            }

            await reload();
        },
        [nextWindowSentence, reload]
    );

    const runAction = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
        if (busy.current) return null;
        busy.current = true;
        setPending(true);
        try {
            return await action();
        } finally {
            busy.current = false;
            setPending(false);
        }
    }, []);

    const activate = useCallback(
        async (placeId: number, minutes: number, placeWasLit: boolean): Promise<LightingFailure | null> => {
            let refusal: LightingFailure | null = null;

            await runAction(async () => {
                setFlash(null);
                const result = await activatePlace(placeId, minutes);

                if (!result.ok) {
                    refusal = result;
                    await handleRefusal(result);
                    return;
                }

                // Mostra o que VEIO, não o que foi pedido: perto do fechamento a
                // Lara apara a duração na janela.
                const granted = result.data.activation?.minutes_remaining ?? minutes;
                const name = result.data.activation?.place_name ?? "";
                if (result.data.extended) {
                    toast.success(`Mais ${formatDuration(granted)} de luz${name ? ` na ${name}` : ""}.`);
                } else if (placeWasLit) {
                    toast.success(`Luz prolongada${name ? ` na ${name}` : ""}: ${formatDuration(granted)} a partir de agora.`);
                } else {
                    toast.success(`Luz acesa${name ? ` na ${name}` : ""} por ${formatDuration(granted)}.`);
                }

                await reload();
            });

            return refusal;
        },
        [handleRefusal, reload, runAction]
    );

    const onPickerActivate = useCallback(
        (place: LightingPlace, minutes: number) => activate(place.id, minutes, place.lit),
        [activate]
    );

    const onExtend = useCallback(
        (minutes: number) => {
            const activation = data?.activation;
            if (activation) activate(activation.place_id, minutes, true);
        },
        [activate, data]
    );

    const onRelease = useCallback(() => {
        runAction(async () => {
            setFlash(null);
            const result = await releaseActivation();

            if (!result.ok) {
                await handleRefusal(result);
                return;
            }

            // Outro sócio pode ter prolongado: olhar `lit_until` antes de dizer que apagou.
            const litUntil = result.data?.lit_until ?? null;
            const stillLit = litUntil !== null && parseInstant(litUntil) > serverNow;
            toast.success(
                stillLit
                    ? `Quadra devolvida. A luz continua acesa até ${formatClock(litUntil)} por outro sócio.`
                    : "Quadra devolvida. Obrigado por liberar a luz."
            );

            await reload();
        });
    }, [handleRefusal, reload, runAction, serverNow]);

    if (status === "loading") return <LoadingScreen />;

    // `club_window` só dá o nome do dia especial para a frase geral; nada é decidido por ele.
    const occasion = data?.open ? windowOccasion(data.club_window) : null;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!data) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos falar com o clube"
                description={error?.error ?? "Tente de novo em instantes."}
                tone="alert"
                action={
                    <button type="button" className={replayStyle.replayButton} onClick={() => reload()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (data.activation) {
        body = (
            <LightingActivePanel
                availability={data}
                serverNow={serverNow}
                pending={pending}
                onExtend={onExtend}
                onRelease={onRelease}
            />
        );
    } else if (data.open) {
        // `open` é agregado: há ALGUMA quadra aberta. Qual está, e por quanto
        // tempo, cada quadra diz na lista.
        body = (
            <LightingPicker
                availability={data}
                serverNow={serverNow}
                pending={pending}
                onActivate={onPickerActivate}
            />
        );
    } else {
        body = <LightingClosed availability={data} serverNow={serverNow} />;
    }

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={replayStyle.replaySection}>
                <div className={replayStyle.replayHeader}>
                    <h1 className={replayStyle.replayTitle}>Luz da quadra</h1>
                    <p className={replayStyle.replayLead}>
                        No uso livre, como nos finais de semana e feriados, não há reserva de quadras: quem chega joga. Por aqui você consegue acionar a luz de qualquer quadra por até 2h.{" "}
                        <strong>Acender não reserva a quadra para uso individual</strong>.
                    </p>
                    {data?.open && !data.activation && (
                        <p className={style.openNow}>
                            <span className={style.openDot} aria-hidden /> Há quadras liberadas agora — cada uma
                            com o seu horário
                            {occasion ? <> · <strong>{occasion}</strong></> : null}
                        </p>
                    )}
                </div>

                {flash && (
                    <div className={`${style.flash} ${flash.tone === "alert" ? style.flashAlert : ""}`} role="status">
                        <div>
                            <strong className={style.flashTitle}>{flash.title}</strong>
                            <p className={style.flashText}>{flash.text}</p>
                        </div>
                        <button type="button" className={style.flashClose} onClick={() => setFlash(null)} aria-label="Fechar aviso">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                )}

                {data && error && (
                    <p className={style.staleWarning}>
                        Não conseguimos atualizar agora; mostrando a última informação do clube.
                    </p>
                )}

                {body}
            </section>

            <Footer />
        </div>
    );
}
