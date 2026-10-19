"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";
import { maskCpf } from "../../../utils/social";

export interface GuestDraft {
    name: string;
    /** Com máscara de digitação; vai sem pontuação para a Lara. */
    cpf: string;
    /** CPF mascarado que a Lara devolveu, só como dica no campo vazio. */
    savedCpf?: string;
}

interface SocialGuestsEditorProps {
    guests: GuestDraft[];
    onChange: (guests: GuestDraft[]) => void;
    /** Teto da lista (`guest_limit` da Lara, ou `max_guests` + extras na pré-reserva). */
    limit: number;
    /** Linha recusada pela Lara (`context.index` de `invalid_guest`). */
    errorIndex: number | null;
    disabled?: boolean;
}

/**
 * Lista nominal de convidados não sócios (nome + CPF — é o que a portaria
 * confere). Sócios não entram aqui. A lista é sempre enviada INTEIRA: quem
 * valida CPF, repetição e teto é a Lara; aqui só se impede passar do
 * `limit` que ela informou.
 */
export default function SocialGuestsEditor({ guests, onChange, limit, errorIndex, disabled }: SocialGuestsEditorProps) {
    const update = (index: number, patch: Partial<GuestDraft>) =>
        onChange(guests.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)));

    const remove = (index: number) => onChange(guests.filter((_, i) => i !== index));

    const add = () => onChange([...guests, { name: "", cpf: "" }]);

    const full = guests.length >= limit;

    return (
        <div className={style.guestList}>
            <div className={style.row}>
                <span className={style.hint}>
                    {guests.length} de {limit} convidado{limit === 1 ? "" : "s"} não sócio{limit === 1 ? "" : "s"}
                </span>
                <button type="button" className={style.secondaryButton} onClick={add} disabled={disabled || full}>
                    <FontAwesomeIcon icon={faPlus} /> Adicionar convidado
                </button>
            </div>

            {guests.map((guest, index) => (
                <div
                    key={index}
                    className={`${style.guestRow} ${errorIndex === index ? style.guestRowError : ""}`}
                >
                    <span className={style.guestIndex}>{index + 1}</span>
                    <div className={style.guestInputs}>
                        <input
                            type="text"
                            placeholder="Nome completo"
                            value={guest.name}
                            onChange={(e) => update(index, { name: e.target.value })}
                            disabled={disabled}
                            aria-label={`Nome do convidado ${index + 1}`}
                            autoComplete="off"
                        />
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder={guest.savedCpf ? `CPF (${guest.savedCpf})` : "CPF"}
                            value={guest.cpf}
                            onChange={(e) => update(index, { cpf: maskCpf(e.target.value) })}
                            disabled={disabled}
                            aria-label={`CPF do convidado ${index + 1}`}
                            autoComplete="off"
                        />
                    </div>
                    <button
                        type="button"
                        className={style.iconButton}
                        onClick={() => remove(index)}
                        disabled={disabled}
                        aria-label={`Remover convidado ${index + 1}`}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            ))}
        </div>
    );
}
