"use client";

/**
 * Disponibilidade da luz da quadra, sempre lida do servidor.
 *
 * Não existe estado local de "aceso": a verdade é o `activation` que a Lara
 * devolve. O sócio pode estar em dois aparelhos, outra pessoa pode prolongar a
 * luz, e o prazo vence sozinho — então o hook relê:
 *
 *  - ao montar, e sempre que a aba volta a ficar visível;
 *  - a cada POLL_INTERVAL_MS enquanto há acionamento ou quadra aberta, com a
 *    aba visível;
 *  - no próximo instante em que a resposta muda de figura (fim do acionamento
 *    ou da luz, abertura da próxima quadra) — sem concluir nada sozinho;
 *  - quando a tela pede, depois de cada ação.
 *
 * Entre leituras só o relógio anda: `serverNow` é o relógio local corrigido pela
 * diferença para o `now` da última resposta, para o contador não depender de o
 * celular estar na hora certa.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
    fetchAvailability,
    type LightingAvailability,
    type LightingFailure,
    type LightingResult,
} from "../../services/lighting-api";
import { parseInstant } from "../../utils/lighting";

/** Releitura periódica no estado "acesa". Longe do throttle de leitura da Lara. */
const POLL_INTERVAL_MS = 45_000;
/** Folga depois de um prazo, para a Lara já ter virado a página quando relermos. */
const DEADLINE_GRACE_MS = 1_500;
/** setTimeout não aceita prazos longos; o timer é rearmado a cada leitura. */
const MAX_TIMER_MS = 6 * 60 * 60 * 1000;

export interface LightingAvailabilityState {
    data: LightingAvailability | null;
    /** Primeira leitura ainda não voltou. */
    loading: boolean;
    /** Última leitura falhou (os dados anteriores, se houver, continuam em `data`). */
    error: LightingFailure | null;
    /** Relógio do servidor estimado, em ms. Anda de segundo em segundo com acionamento. */
    serverNow: number;
    reload: () => Promise<LightingResult<LightingAvailability>>;
}

function isVisible(): boolean {
    return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * O próximo instante em que a resposta do servidor deve mudar. Fim de janela
 * não entra: cada quadra tem a sua, e quem cobre isso é a releitura periódica.
 */
function nextDeadline(data: LightingAvailability, serverNow: number): number | null {
    const candidates: number[] = [];

    if (data.activation) {
        candidates.push(parseInstant(data.activation.ends_at));
        candidates.push(parseInstant(data.activation.lit_until));
    }
    // A primeira quadra a abrir (ou a próxima, com outra já aberta).
    candidates.push(parseInstant(data.next_window?.starts_at));

    const future = candidates.filter((t) => !Number.isNaN(t) && t > serverNow);
    return future.length > 0 ? Math.min(...future) : null;
}

export function useLightingAvailability(): LightingAvailabilityState {
    const [data, setData] = useState<LightingAvailability | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<LightingFailure | null>(null);
    const [offsetMs, setOffsetMs] = useState(0);
    const [localNow, setLocalNow] = useState(() => Date.now());

    const inFlight = useRef<Promise<LightingResult<LightingAvailability>> | null>(null);

    const reload = useCallback(() => {
        // Duas releituras simultâneas viram uma.
        if (inFlight.current) return inFlight.current;

        const request = (async () => {
            const result = await fetchAvailability();
            const receivedAt = Date.now();

            if (result.ok) {
                const server = parseInstant(result.data.now);
                setOffsetMs(Number.isNaN(server) ? 0 : server - receivedAt);
                setData(result.data);
                setError(null);
            } else if (result.kind !== "unauthorized") {
                // 401 já foi tratado pelo interceptor (login); não vira estado de tela.
                setError(result);
            }

            setLocalNow(receivedAt);
            setLoading(false);
            return result;
        })();

        inFlight.current = request;
        request.finally(() => {
            inFlight.current = null;
        });
        return request;
    }, []);

    const hasActivation = Boolean(data?.activation);
    // Aberto também relê: o tempo de cada quadra encolhe, quadras abrem e
    // fecham em horários diferentes, e outro sócio pode acender ou prolongar.
    const shouldPoll = hasActivation || Boolean(data?.open);

    // Primeira leitura, e releitura ao voltar para a aba.
    useEffect(() => {
        reload();

        const onVisibility = () => {
            if (isVisible()) reload();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [reload]);

    // Contador: o relógio anda localmente entre as leituras.
    useEffect(() => {
        if (!hasActivation) return;
        const tick = setInterval(() => setLocalNow(Date.now()), 1000);
        return () => clearInterval(tick);
    }, [hasActivation]);

    // Releitura periódica, com acionamento ou com alguma quadra aberta, e só com a aba visível.
    useEffect(() => {
        if (!shouldPoll) return;
        const poll = setInterval(() => {
            if (isVisible()) reload();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(poll);
    }, [shouldPoll, reload]);

    // Releitura no próximo prazo que a própria resposta anuncia.
    useEffect(() => {
        if (!data) return;

        const now = Date.now() + offsetMs;
        const deadline = nextDeadline(data, now);
        if (deadline === null) return;

        const delay = Math.min(deadline - now + DEADLINE_GRACE_MS, MAX_TIMER_MS);
        const timer = setTimeout(() => {
            if (isVisible()) reload();
        }, delay);
        return () => clearTimeout(timer);
    }, [data, offsetMs, reload]);

    return { data, loading, error, serverNow: localNow + offsetMs, reload };
}
