import type { Metadata } from "next";
import "@/styles/globals.css";
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

import { UserProvider } from '@/context/UserContext';
import { ToastContainer } from "react-toastify";


export const metadata: Metadata = {
  title: "Clube dos Funcionários",
  description: "O melhor da vida é aqui.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="pt-br">
      <body >
        <UserProvider>
          {children}
        </UserProvider>
        <ToastContainer
            position="bottom-right"
            autoClose={5000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl={false}
            escapeMarkup={true}
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover={false}
            theme="light"
        />
      </body>
    </html>
  );
}