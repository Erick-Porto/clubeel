"use client";

/**
 * Lançamento de resultados pela EQUIPE DO CLUBE (não é tela de sócio).
 *
 * Não usa o login de sócio (fora do matcher do middleware, e o TokenValidator
 * fica desligado aqui): a organização gera no Lara um código de lançamento do
 * torneio e passa para quem vai lançar. O código vai no header
 * `Tournament-Code` de cada chamada (o proxy repassa só nas rotas `staff/*`) e
 * fica guardado só na sessão do navegador (sessionStorage), junto com o nome
 * de quem lança — o nome vai em todo lançamento, para o histórico do jogo.
 * Código errado, vencido ou retirado: 401 `invalid_code` → volta para a tela
 * do código.
 *
 * O que dá para lançar é a Lara que diz (`editable`). Jogo `locked` foi lançado
 * pela organização no Lara: mostra o placar, sem editar. Depois de cada
 * lançamento os jogos são relidos — o vencedor já aparece no jogo seguinte.
 * Pensada para celular: é usada na beira da quadra.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCircleExclamation,
    faLock,
    faPen,
    faRightFromBracket,
    faRotateRight,
    faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import ui from "../../../../styles/ui.module.css";
import headerStyle from "../../../../styles/header.module.css";
import style from "../../../../styles/tournament.module.css";
import { Loading } from "../../../components/Common/loading";
import ReplayNotice from "../../../components/Replay/ReplayNotice";
import SocialFlashBox from "../../../components/Social/SocialFlashBox";
import { Pill, areaStyle } from "../../../components/UI/ui";
import MatchCard from "../../../components/Tournament/MatchCard";
import ScoreEditor from "../../../components/Tournament/ScoreEditor";
import {
    staffCheck,
    staffMatches,
    staffSaveResult,
    type StaffMatches,
    type StaffResult,
    type TournamentFailure,
    type TournamentMatch,
} from "../../../../services/tournament-api";
import { formatInstant, idFromParam, type TournamentFlash } from "../../../../utils/tournament";
import { comBase } from "../../../../utils/base-path";

interface StaffSession {
    code: string;
    operator: string;
}

const storageKey = (tournamentId: number) => `torneio-equipe:${tournamentId}`;

function readSession(tournamentId: number): StaffSession | null {
    try {
        const raw = window.sessionStorage.getItem(storageKey(tournamentId));
        const parsed = raw ? (JSON.parse(raw) as Partial<StaffSession>) : null;
        return parsed?.code && parsed.operator ? { code: parsed.code, operator: parsed.operator } : null;
    } catch {
        return null;
    }
}

function writeSession(tournamentId: number, value: StaffSession | null) {
    try {
        if (value) window.sessionStorage.setItem(storageKey(tournamentId), JSON.stringify(value));
        else window.sessionStorage.removeItem(storageKey(tournamentId));
    } catch {
        // Sem sessionStorage (aba anônima restrita): o código vale só nesta tela.
    }
}

/** "abcd efgh" → "ABCD-EFGH" (a Lara ignora maiúsculas, espaço e hífen). */
function formatCode(value: string): string {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Títulos das recusas do lançamento, pelo `reason` (o texto é o da Lara). */
const STAFF_TITLES: Record<string, string> = {
    invalid_score: "Confira o placar",
    match_locked: "Resultado lançado pela organização",
    match_not_ready: "O jogo ainda não tem os dois times",
    next_match_played: "O jogo seguinte já tem resultado",
    group_closed: "O grupo já foi fechado pela organização",
    results_closed: "Este torneio não aceita mais resultado pelo site",
    match_not_found: "Jogo não encontrado",
    invalid_code: "Código inválido",
};

function staffFlash(failure: TournamentFailure): TournamentFlash {
    const title = STAFF_TITLES[failure.reason ?? ""] ?? "Não foi possível salvar";
    return { tone: failure.kind === "rule" ? "neutral" : "alert", title, text: failure.error };
}

interface MatchEntry {
    match: TournamentMatch;
    categoryId: number;
    categoryName: string;
    setsToWin: number;
    label: string;
}

/** Todos os jogos de todas as categorias, na ordem da Lara (grupos, depois mata-mata). */
function flatten(data: StaffMatches): MatchEntry[] {
    return data.categories.flatMap((category) =>
        category.stages.flatMap((stage) =>
            stage.type === "group"
                ? stage.groups.flatMap((group) =>
                      group.matches.map((match) => ({
                          match,
                          categoryId: category.category_id,
                          categoryName: category.category_name,
                          setsToWin: category.sets_to_win,
                          label: [group.name, match.round_label].filter(Boolean).join(" · "),
                      }))
                  )
                : stage.matches.map((match) => ({
                      match,
                      categoryId: category.category_id,
                      categoryName: category.category_name,
                      setsToWin: category.sets_to_win,
                      label: match.round_label,
                  }))
        )
    );
}

export default function StaffPage() {
    const params = useParams();
    const tournamentId = idFromParam(params?.id);

    const [session, setSession] = useState<StaffSession | null>(null);
    const [restoring, setRestoring] = useState(true);
    const [codeInput, setCodeInput] = useState("");
    const [operatorInput, setOperatorInput] = useState("");
    const [checkError, setCheckError] = useState<TournamentFailure | null>(null);
    const [validUntil, setValidUntil] = useState<string | null>(null);
    const [data, setData] = useState<StaffMatches | null>(null);
    const [loadError, setLoadError] = useState<TournamentFailure | null>(null);
    const [loading, setLoading] = useState(false);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [onlyPending, setOnlyPending] = useState(true);
    const [editing, setEditing] = useState<number | null>(null);
    const [flash, setFlash] = useState<TournamentFlash | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);

    const leave = useCallback(
        (failure?: TournamentFailure) => {
            if (tournamentId) writeSession(tournamentId, null);
            setSession(null);
            setData(null);
            setEditing(null);
            setFlash(null);
            if (failure) setCheckError(failure);
        },
        [tournamentId]
    );

    const loadMatches = useCallback(
        async (current: StaffSession, quiet = false) => {
            if (!tournamentId) return;
            if (!quiet) setLoading(true);
            const result = await staffMatches(tournamentId, current.code);
            if (result.ok) {
                setData(result.data);
                setLoadError(null);
            } else if (result.status === 401) {
                leave(result);
            } else if (!quiet) {
                setLoadError(result);
            }
            setLoading(false);
        },
        [tournamentId, leave]
    );

    // Volta direto aos jogos se o código já está na sessão desta aba.
    useEffect(() => {
        if (!tournamentId) {
            setRestoring(false);
            return;
        }
        const saved = readSession(tournamentId);
        if (saved) {
            setSession(saved);
            setOperatorInput(saved.operator);
            loadMatches(saved);
        }
        setRestoring(false);
    }, [tournamentId, loadMatches]);

    const enter = async () => {
        if (!tournamentId || busy.current) return;
        const code = codeInput.trim();
        const operator = operatorInput.trim();
        if (!code || !operator) return;
        busy.current = true;
        setPending(true);
        setCheckError(null);
        try {
            const result = await staffCheck(tournamentId, code);
            if (!result.ok) {
                setCheckError(result);
                return;
            }
            const next = { code, operator };
            writeSession(tournamentId, next);
            setSession(next);
            setValidUntil(result.data.valid_until);
            setCodeInput("");
            await loadMatches(next);
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const save = async (entry: MatchEntry, result: StaffResult) => {
        if (!tournamentId || !session || busy.current) return;
        busy.current = true;
        setPending(true);
        setFlash(null);
        try {
            const response = await staffSaveResult(tournamentId, entry.match.id, session.code, session.operator, result);
            if (response.ok) {
                toast.success("Resultado salvo.");
                setEditing(null);
            } else if (response.status === 401) {
                leave(response);
                return;
            } else {
                setFlash(staffFlash(response));
                requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
                // Travado, grupo fechado, jogo seguinte jogado: o jogo mudou — fecha o editor e relê.
                if (response.reason && response.reason !== "invalid_score") setEditing(null);
            }
            await loadMatches(session, true);
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const title = data?.tournament.title ?? "Lançamento de resultados";

    let body: React.ReactNode;
    if (!tournamentId) {
        body = <ReplayNotice icon={faCircleExclamation} title="Torneio não encontrado" description="Confira o link recebido da organização." tone="alert" />;
    } else if (restoring) {
        body = <Loading />;
    } else if (!session) {
        body = (
            <form
                className={ui.panel}
                onSubmit={(event) => {
                    event.preventDefault();
                    enter();
                }}
            >
                <h1 className={ui.sectionTitle}>Entrar para lançar resultados</h1>
                <p className={style.hint}>
                    Use o código de lançamento que a organização do torneio passou para você. Ele vale até o fim do último dia
                    do torneio.
                </p>
                {checkError && (
                    <SocialFlashBox
                        flash={
                            checkError.status === 401
                                ? { tone: "alert", title: "Código inválido", text: checkError.error || "Código errado, vencido ou retirado. Peça um novo à organização." }
                                : staffFlash(checkError)
                        }
                        onClose={() => setCheckError(null)}
                    />
                )}
                <div className={style.field}>
                    <label htmlFor="codigo">Código de lançamento</label>
                    <input
                        id="codigo"
                        className={style.codeInput}
                        value={codeInput}
                        onChange={(event) => setCodeInput(formatCode(event.target.value))}
                        placeholder="ABCD-EFGH"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        inputMode="text"
                        required
                    />
                </div>
                <div className={style.field}>
                    <label htmlFor="operador">Seu nome</label>
                    <input
                        id="operador"
                        value={operatorInput}
                        maxLength={80}
                        onChange={(event) => setOperatorInput(event.target.value)}
                        placeholder="Ex.: Carlos (quadra 2)"
                        autoComplete="name"
                        required
                    />
                    <span className={style.hint}>Aparece no histórico de cada jogo que você lançar.</span>
                </div>
                <button type="submit" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnBlock}`} disabled={pending}>
                    {pending ? "Conferindo..." : "Entrar"}
                </button>
            </form>
        );
    } else if (loading && !data) {
        body = <Loading />;
    } else if (loadError && !data) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar os jogos"
                description={loadError.error}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => loadMatches(session)}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (data) {
        const entries = flatten(data).filter(
            (entry) =>
                entry.match.status !== "bye" &&
                (categoryId === null || entry.categoryId === categoryId) &&
                (!onlyPending || entry.match.status === "pending")
        );

        body = (
            <>
                {data.categories.length === 0 ? (
                    <ReplayNotice
                        icon={faTrophy}
                        title="Nenhum chaveamento gerado ainda"
                        description="Os jogos aparecem aqui assim que a organização gerar o chaveamento no Lara."
                    />
                ) : (
                    <>
                        {data.categories.length > 1 && (
                            <div className={style.field}>
                                <label htmlFor="categoria">Categoria</label>
                                <select
                                    id="categoria"
                                    value={categoryId ?? ""}
                                    onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)}
                                >
                                    <option value="">Todas as categorias</option>
                                    {data.categories.map((category) => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className={style.rowBetween}>
                            <label className={style.toggle}>
                                <input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />
                                Só jogos a jogar
                            </label>
                            <button
                                type="button"
                                className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                onClick={() => loadMatches(session, true)}
                                disabled={pending}
                            >
                                <FontAwesomeIcon icon={faRotateRight} /> Atualizar
                            </button>
                        </div>

                        <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                        {entries.length === 0 ? (
                            <ReplayNotice
                                icon={faTrophy}
                                title={onlyPending ? "Nenhum jogo a jogar" : "Nenhum jogo"}
                                description={onlyPending ? "Desmarque “Só jogos a jogar” para ver e corrigir os encerrados." : undefined}
                            />
                        ) : (
                            <div className={style.matchStack}>
                                {entries.map((entry) => {
                                    const { match } = entry;
                                    const decided = match.status === "finished" || match.status === "walkover";
                                    const label = (
                                        <span>
                                            {data.categories.length > 1 && categoryId === null ? `${entry.categoryName} · ` : ""}
                                            {entry.label}
                                        </span>
                                    );
                                    let footer: React.ReactNode = null;
                                    if (editing === match.id) {
                                        footer = (
                                            <div className={style.fullWidth}>
                                                <ScoreEditor
                                                    match={match}
                                                    setsToWin={entry.setsToWin}
                                                    pending={pending}
                                                    onSave={(result) => save(entry, result)}
                                                    onCancel={() => setEditing(null)}
                                                />
                                            </div>
                                        );
                                    } else if (match.locked) {
                                        footer = (
                                            <Pill kind="info" icon={faLock}>
                                                Lançado pela organização
                                            </Pill>
                                        );
                                    } else if (match.editable) {
                                        footer = (
                                            <>
                                                {decided && match.result_origin === "site" && (
                                                    <span className={style.hint}>Lançado pela equipe</span>
                                                )}
                                                <button
                                                    type="button"
                                                    className={`${ui.btn} ${decided ? ui.btnSecondary : ui.btnPrimary} ${ui.btnSm}`}
                                                    onClick={() => {
                                                        setFlash(null);
                                                        setEditing(match.id);
                                                    }}
                                                    disabled={pending || editing !== null}
                                                >
                                                    <FontAwesomeIcon icon={faPen} /> {decided ? "Corrigir" : "Lançar"}
                                                </button>
                                            </>
                                        );
                                    }
                                    return <MatchCard key={match.id} match={match} label={label} footer={footer} />;
                                })}
                            </div>
                        )}
                    </>
                )}
            </>
        );
    }

    return (
        <div className={style.staffShell}>
            <header className={style.staffTop} style={areaStyle("torneios")}>
                <div className={style.staffTopInner}>
                    <Image
                        src={comBase("/images/logo-cfcsn-horiz.png")}
                        alt="Clube dos Funcionários CSN"
                        width={90}
                        height={36}
                        className={headerStyle.logoLight}
                    />
                    <Image
                        src={comBase("/images/logo-cfcsn-w-horiz.png")}
                        alt=""
                        width={90}
                        height={36}
                        className={headerStyle.logoDark}
                    />
                    <div className={style.staffTitle}>
                        <strong>{title}</strong>
                        <span>
                            {session
                                ? `${session.operator}${validUntil ? ` · código vale até ${formatInstant(validUntil)}` : ""}`
                                : "Equipe do clube"}
                        </span>
                    </div>
                    {session && (
                        <button
                            type="button"
                            className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                            onClick={() => leave()}
                            aria-label="Sair do lançamento"
                        >
                            <FontAwesomeIcon icon={faRightFromBracket} /> Sair
                        </button>
                    )}
                </div>
            </header>

            <main className={style.staffMain}>{body}</main>
        </div>
    );
}
