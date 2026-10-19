import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { config } from '@fortawesome/fontawesome-svg-core'
import TokenValidator from "./components/Auth/TokenValidator";
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

import { NextAuthProvider } from './components/provider';
import { ToastContainer } from "react-toastify";
import { CartProvider } from "../context/CartContext";
import { THEME_SCRIPT } from "./components/Common/theme-script";

export const metadata: Metadata = {
  title: "Clube dos Funcionários",
  description: "Conectando gerações.",
};

// `viewport-fit=cover` libera as áreas seguras do iPhone (env(safe-area-inset-*))
// usadas pela barra inferior de módulos.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3F3" },
    { media: "(prefers-color-scheme: dark)", color: "#120C0E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    // O script do tema mexe em `data-theme` antes da hidratação.
    <html lang="pt-br" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body >
        <NextAuthProvider>
          <CartProvider>
            <TokenValidator />
            {children}
          </CartProvider>
        </NextAuthProvider>
        <ToastContainer
            position="bottom-right"
            autoClose={5000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover={false}
            theme="light"
        />
      </body>
    </html>
  );
}
