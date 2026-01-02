import type { Metadata } from "next";
import "@/styles/globals.css";
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

import { NextAuthProvider } from '@/components/provider';
import { ToastContainer } from "react-toastify";
import { CartProvider } from "@/context/CartContext"; 

export const metadata: Metadata = {
  title: "Clube dos Funcionários",
  description: "Conectando gerações.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="pt-br">
      <body >
        <NextAuthProvider>
          <CartProvider>
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