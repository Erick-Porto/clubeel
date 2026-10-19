/**
 * Chave e script do tema, num módulo comum (sem "use client") para o layout
 * raiz — Server Component — poder importar o texto do script. Exportado de um
 * arquivo "use client", ele chegaria ao servidor como referência, não como texto.
 */

export const THEME_STORAGE_KEY = "cfcsn-theme";

/** Roda antes da pintura: aplica o tema fixado pelo sócio, se houver. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
