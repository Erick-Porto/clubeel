"use client";

/**
 * Time do sócio (sócio logado; no matcher do middleware). Lido de
 * `GET tournaments/my-teams` — só aparece time de que ele faz parte.
 *
 * Todos veem os membros e quem já pagou. O capitão (`is_captain`) vê também os
 * convites pendentes, retira convite e convida: busca pela matrícula (traz a
 * família do título) ou pelo CPF, escolhe a pessoa e o convite vai pela `ref`
 * opaca — o CPF nunca volta da Lara. Sexo, idade, vaga no time (contando
 * convites pendentes) e "já está noutro time" a Lara confere no convite.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCircleExclamation,
    faCrown,
    faMagnifyingGlass,
    faPaperPlane,
    faRotateRight,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../../styles/page.module.css";
import ui from "../../../../styles/ui.module.css";
import style from "../../../../styles/tournament.module.css";
import Header from "../../../components/Common/header";
import Footer from "../../../components/Common/footer";
import { Loading, LoadingScreen } from "../../../components/Common/loading";
import ReplayNotice from "../../../components/Replay/ReplayNotice";
import SocialFlashBox from "../../../components/Social/SocialFlashBox";
import { TournamentCover } from "../../../components/UI/covers";
import { PageHeader, Pill, initialsOf } from "../../../components/UI/ui";
import {
    cancelInvite,
    fetchMyTeams,
    inviteToTeam,
    lookupMember,
    type MemberLookupResult,
    type MyTeam,
    type TournamentFailure,
} from "../../../../services/tournament-api";
import { isSilent, refusalFlash, teamTone, tournamentHref, type TournamentFlash } from "../../../../utils/tournament";
import { maskCpf, onlyDigits } from "../../../../utils/social";

/** Recusas que mudam o time: relê para mostrar membros e convites atuais. */
const RELOAD_REASONS = new Set(["team_full", "already_in_team", "team_not_found", "registration_closed", "not_captain"]);

export default function TeamPage() {
    const { status } = useSession();
    const params = useParams();
    const teamId = Number(params?.id);
    const validId = Number.isInteger(teamId) && teamId > 0;

    const [team, setTeam] = useState<MyTeam | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<TournamentFailure | null>(null);
    const [flash, setFlash] = useState<TournamentFlash | null>(null);
    const [searchBy, setSearchBy] = useState<"title" | "cpf">("title");
    const [searchValue, setSearchValue] = useState("");
    const [results, setResults] = useState<MemberLookupResult[] | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        if (!validId) {
            setLoading(false);
            return;
        }
        const result = await fetchMyTeams();
        if (result.ok) {
            setTeam(result.data.find((item) => item.id === teamId) ?? null);
            setLoadError(null);
        } else if (!isSilent(result)) {
            setLoadError(result);
        }
        setLoading(false);
    }, [teamId, validId]);

    useEffect(() => {
        if (status === "authenticated") load();
    }, [status, load]);

    const showFlash = (next: TournamentFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const runAction = async (action: () => Promise<void>) => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setFlash(null);
        try {
            await action();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const search = () =>
        runAction(async () => {
            const value = searchBy === "cpf" ? onlyDigits(searchValue) : searchValue.trim();
            if (!value) return;
            const result = await lookupMember(searchBy, value);
            if (result.ok) setResults(result.data);
            else {
                setResults(null);
                if (!isSilent(result)) showFlash(refusalFlash(result, "Não foi possível buscar"));
            }
        });

    const invite = (person: MemberLookupResult) =>
        runAction(async () => {
            if (!team) return;
            const result = await inviteToTeam(team.id, person.ref);
            if (result.ok) {
                toast.success(`Convite enviado para ${person.name}. A pessoa recebe um e-mail.`);
                setResults(null);
                setSearchValue("");
            } else if (!isSilent(result)) {
                showFlash(refusalFlash(result, "Não foi possível convidar"));
                if (result.reason && !RELOAD_REASONS.has(result.reason)) return;
            }
            await load();
        });

    const withdrawInvite = (inviteId: number, name: string) =>
        runAction(async () => {
            const result = await cancelInvite(inviteId);
            if (result.ok) toast.info(`Convite de ${name} retirado.`);
            else if (!isSilent(result)) showFlash(refusalFlash(result, "Não foi possível retirar o convite"));
            await load();
        });

    if (status === "loading") return <LoadingScreen />;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (loadError) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar o time"
                description={loadError.error}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (!team) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Time não encontrado"
                description="Ele pode ter sido desfeito, ou você não faz parte dele."
                action={
                    <Link href="/torneios/inscricoes" className={`${ui.btn} ${ui.btnPrimary}`}>
                        Minhas inscrições
                    </Link>
                }
            />
        );
    } else {
        // Só para decidir se o formulário aparece; quem recusa (`team_full`) é a Lara.
        const seatsTaken = team.members.length + team.pending_invites.length;
        body = (
            <>
                <PageHeader
                    kicker={
                        <Link href={tournamentHref(team.tournament.title, team.tournament.id)}>
                            {team.tournament.title} · {team.category.name}
                        </Link>
                    }
                    title={team.name}
                    lead={`Time de ${team.team_size} pessoa${team.team_size === 1 ? "" : "s"}. Fica completo quando todos entram e pagam a inscrição.`}
                    actions={<Pill kind={teamTone(team.status)}>{team.status_label}</Pill>}
                />

                <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                <div className={ui.panel}>
                    <h2 className={ui.sectionTitle}>Membros</h2>
                    <ul className={style.memberList}>
                        {team.members.map((member, index) => (
                            <li key={`${member.name}-${index}`} className={style.member}>
                                <span className={style.memberAvatar}>{initialsOf(member.name)}</span>
                                <span className={style.memberName}>{member.name}</span>
                                {member.captain && (
                                    <Pill kind="info" icon={faCrown}>
                                        Capitão
                                    </Pill>
                                )}
                                <Pill kind={member.paid ? "ok" : "warn"}>{member.paid ? "Pagou" : "Falta pagar"}</Pill>
                            </li>
                        ))}
                    </ul>

                    {team.is_captain && team.pending_invites.length > 0 && (
                        <>
                            <span className={ui.label}>Convites pendentes</span>
                            <ul className={style.memberList}>
                                {team.pending_invites.map((pendingInvite) => (
                                    <li key={pendingInvite.id} className={style.member}>
                                        <span className={style.memberAvatar}>{initialsOf(pendingInvite.name)}</span>
                                        <span className={style.memberName}>{pendingInvite.name}</span>
                                        <Pill kind="off">Aguardando resposta</Pill>
                                        <button
                                            type="button"
                                            className={`${ui.btn} ${ui.btnSm} ${ui.btnDanger}`}
                                            onClick={() => withdrawInvite(pendingInvite.id, pendingInvite.name)}
                                            disabled={pending}
                                        >
                                            <FontAwesomeIcon icon={faXmark} /> Retirar
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                {team.is_captain && seatsTaken < team.team_size && (
                    <div className={ui.panel}>
                        <h2 className={ui.sectionTitle}>Convidar</h2>
                        <p className={style.hint}>
                            Busque pela matrícula do título (aparece a família toda) ou pelo CPF da pessoa. Ela recebe o
                            convite por e-mail e, ao aceitar, entra no time e paga a própria inscrição.
                        </p>
                        <nav className={ui.seg} aria-label="Buscar por">
                            <button
                                type="button"
                                className={`${ui.segItem} ${searchBy === "title" ? ui.segActive : ""}`}
                                aria-pressed={searchBy === "title"}
                                onClick={() => {
                                    setSearchBy("title");
                                    setSearchValue("");
                                    setResults(null);
                                }}
                            >
                                Matrícula
                            </button>
                            <button
                                type="button"
                                className={`${ui.segItem} ${searchBy === "cpf" ? ui.segActive : ""}`}
                                aria-pressed={searchBy === "cpf"}
                                onClick={() => {
                                    setSearchBy("cpf");
                                    setSearchValue("");
                                    setResults(null);
                                }}
                            >
                                CPF
                            </button>
                        </nav>
                        <form
                            className={style.inlineForm}
                            onSubmit={(event) => {
                                event.preventDefault();
                                search();
                            }}
                        >
                            <label>
                                {searchBy === "title" ? "Matrícula" : "CPF"}
                                <input
                                    type="text"
                                    inputMode={searchBy === "cpf" ? "numeric" : "text"}
                                    autoComplete="off"
                                    value={searchValue}
                                    placeholder={searchBy === "title" ? "Ex.: 1002" : "000.000.000-00"}
                                    onChange={(event) =>
                                        setSearchValue(searchBy === "cpf" ? maskCpf(event.target.value) : event.target.value)
                                    }
                                />
                            </label>
                            <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending || !searchValue.trim()}>
                                <FontAwesomeIcon icon={faMagnifyingGlass} /> {pending ? "Buscando..." : "Buscar"}
                            </button>
                        </form>

                        {results !== null &&
                            (results.length === 0 ? (
                                <p className={style.hint}>Ninguém encontrado. Confira o número digitado.</p>
                            ) : (
                                <ul className={style.lookupResults}>
                                    {results.map((person) => (
                                        <li key={person.ref} className={style.member}>
                                            <span className={style.memberAvatar}>{initialsOf(person.name)}</span>
                                            <span className={style.memberName}>
                                                {person.name}
                                                <br />
                                                <small className={`${ui.muted} ${style.mono}`}>{person.cpf_masked}</small>
                                            </span>
                                            <Pill kind="off">{person.titular ? "Titular" : "Dependente"}</Pill>
                                            <button
                                                type="button"
                                                className={`${ui.btn} ${ui.btnSm} ${ui.btnPrimary}`}
                                                onClick={() => invite(person)}
                                                disabled={pending}
                                            >
                                                <FontAwesomeIcon icon={faPaperPlane} /> Convidar
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                    </div>
                )}

                {!team.is_captain && (
                    <p className={style.hint}>Quem convida e retira convites é o capitão do time.</p>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TournamentCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href="/torneios/inscricoes" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Minhas inscrições
                </Link>
                {body}
            </main>

            <Footer />
        </div>
    );
}
