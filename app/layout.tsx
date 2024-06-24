import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import { Inter } from "next/font/google";
import "react-loading-skeleton/dist/skeleton.css";
import "simplebar-react/dist/simplebar.min.css";
import { cn, constructMetadata } from "../lib/utils";
import "./globals.css";

import { Toaster } from 'react-hot-toast';
// import { Toaster } from "@/components/ui/toaster";
const inter = Inter({ subsets: ["latin"] });

export const metadata=constructMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <Providers>
      <body className={cn('min-h-screen font-sans antialiased grainy',inter.className)}>
      <Toaster />
      
        <Navbar></Navbar>
        

        {children}</body>
        </Providers>
    </html>
  );
}
