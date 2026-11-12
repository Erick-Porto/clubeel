/**
 * Área do painel (dashboards do administrador).
 *
 * Usa a sessão de sócio que o site já guarda, mas fica separada da área do
 * sócio: casca própria (PainelCasca), fora dos buscadores e com tudo buscado no
 * servidor — o navegador não alcança a Lara. Quem pode ver é a Lara que diz, a
 * cada página (`GET /api/dashboard/access`); ver docs/resumo-modulos/18-painel.md.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Painel | Clube dos Funcionários",
    robots: { index: false, follow: false },
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
    return children;
}
