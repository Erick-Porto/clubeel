"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag, faXmark } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Pill } from "../UI/ui";
import { checkCoupon, type CouponPreview } from "../../../services/ticket-api";
import { couponFitsBuyer, refusalFlash, type BuyerKind } from "../../../utils/ticket";

interface CouponFieldProps {
    eventId: number;
    kind: BuyerKind;
    applied: CouponPreview | null;
    onChange: (coupon: CouponPreview | null) => void;
    /** Recusa do cupom na criação do pedido (a tela manda; o campo mostra). */
    error: string | null;
    disabled?: boolean;
}

/**
 * [v2] Campo "Cupom" do checkout. Confere antes (`coupon-check`) só para
 * mostrar a prévia; quem calcula o desconto é a Lara, no pedido. Recusado, a
 * pessoa pode seguir sem cupom.
 */
export default function CouponField({ eventId, kind, applied, onChange, error, disabled }: CouponFieldProps) {
    const [code, setCode] = useState("");
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (error) setMessage(error);
    }, [error]);

    const apply = async () => {
        const trimmed = code.trim();
        if (!trimmed || checking) return;
        setChecking(true);
        setMessage(null);
        const result = await checkCoupon(eventId, trimmed, kind);
        setChecking(false);
        if (result.ok) {
            onChange(result.data);
            setCode("");
        } else {
            const flash = refusalFlash(result, "Não foi possível conferir o cupom");
            setMessage(flash.text ? `${flash.title}. ${flash.text}` : flash.title);
        }
    };

    if (applied) {
        return (
            <div className={style.stack}>
                <div className={style.couponApplied}>
                    <Pill kind="ok" icon={faTag}>
                        {applied.code} · {applied.label}
                    </Pill>
                    {applied.description && <span className={style.hint}>{applied.description}</span>}
                    <button
                        type="button"
                        className={ui.linkButton}
                        onClick={() => {
                            onChange(null);
                            setMessage(null);
                        }}
                        disabled={disabled}
                    >
                        <FontAwesomeIcon icon={faXmark} /> Remover
                    </button>
                </div>
                {!couponFitsBuyer(applied, kind) && (
                    <span className={style.fieldError}>Este cupom não vale para esta forma de compra.</span>
                )}
                {applied.type_ids && <span className={style.hint}>Vale só para alguns tipos de ingresso.</span>}
                {error && <span className={style.fieldError}>{error}</span>}
            </div>
        );
    }

    return (
        <div className={`${style.field} ${message ? style.fieldInvalid : ""}`}>
            <label htmlFor="cupom">Cupom de desconto (opcional)</label>
            <div className={style.coupon}>
                <input
                    id="cupom"
                    type="text"
                    value={code}
                    autoComplete="off"
                    maxLength={40}
                    placeholder="CÓDIGO"
                    onChange={(event) => {
                        setCode(event.target.value);
                        setMessage(null);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            apply();
                        }
                    }}
                    disabled={disabled}
                />
                <button
                    type="button"
                    className={`${ui.btn} ${ui.btnSecondary}`}
                    onClick={apply}
                    disabled={disabled || checking || !code.trim()}
                >
                    {checking ? "Conferindo..." : "Aplicar"}
                </button>
            </div>
            {message && <span className={style.fieldError}>{message}</span>}
        </div>
    );
}
