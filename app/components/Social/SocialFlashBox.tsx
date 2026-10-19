"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import lightingStyle from "../../../styles/lighting.module.css";
import type { SocialFlash } from "../../../utils/social";

/**
 * Aviso fechável das recusas — o mesmo da tela de luz. O título sai do
 * `reason` da Lara (utils/social.ts) e o texto é o que ela escreveu.
 */
export default function SocialFlashBox({ flash, onClose }: { flash: SocialFlash; onClose: () => void }) {
    return (
        <div
            className={`${lightingStyle.flash} ${flash.tone === "alert" ? lightingStyle.flashAlert : ""}`}
            role="status"
        >
            <div>
                <strong className={lightingStyle.flashTitle}>{flash.title}</strong>
                {flash.text && <p className={lightingStyle.flashText}>{flash.text}</p>}
            </div>
            <button type="button" className={lightingStyle.flashClose} onClick={onClose} aria-label="Fechar aviso">
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </div>
    );
}
