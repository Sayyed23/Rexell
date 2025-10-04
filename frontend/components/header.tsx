"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export function Header() {
  const { isConnected, address } = useAccount();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const navLinks = [
    {
      name: "Explore events",
      href: "/events",
    },
    {
      name: "Create event",
      href: "/create-event",
    },
    {
      name: "My events",
      href: "/my-events",
    },
    {
      name: "My tickets",
      href: "/my-tickets",
    },
    {
      name: "Market",
      href: "/market",
    },
  ];

  // Don't render anything on the server to prevent hydration mismatch
  if (!isClient) {
    return (
      <header className="bg-white">
        <div className="md:hidden flex items-center justify-center">
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex-1 md:flex md:items-center md:gap-12">
              <div className="block text-2xl font-bold lg:text-3xl text-blue-600">
                <span className="sr-only">Rexell</span>
                <span className="hidden sm:block">Rexell</span>
                <span className="sm:hidden">Rexell</span>
              </div>
            </div>
            <div className="md:flex md:items-center md:gap-12">
              <nav aria-label="Global" className="hidden lg:block">
                <ul className="flex items-center gap-6 text-sm">
                  {navLinks.map((link) => (
                    <li key={link.name}>
                      <Link
                        className="text-gray-500 transition hover:text-gray-500/75 hover:underline"
                        href={link.href}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      className="text-gray-500 transition hover:text-gray-500/75 hover:underline"
                      href="/owner/resale-requests"
                    >
                      Manage Resales
                    </Link>
                  </li>
                </ul>
              </nav>
              <div className="hidden sm:block">
                <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white">
      <div className="md:hidden flex items-center justify-center">
        <ConnectButton
          showBalance={{
            smallScreen: false,
            largeScreen: true,
          }}
        />
      </div>
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <div className="flex-1 md:flex md:items-center md:gap-12">
            <a className="block text-2xl font-bold lg:text-3xl text-blue-600" href="/">
              <span className="sr-only">Rexell</span>
              <span className="hidden sm:block">Rexell</span>
              <span className="sm:hidden">Rexell</span>
            </a>
          </div>

          <div className="md:flex md:items-center md:gap-12">
            <nav aria-label="Global" className="hidden lg:block">
              <ul className="flex items-center gap-6 text-sm">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      className="text-gray-500 transition hover:text-gray-500/75 hover:underline"
                      href={link.href}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
                {/* Owner dashboard for resale management */}
                <li>
                  <Link
                    className="text-gray-500 transition hover:text-gray-500/75 hover:underline"
                    href="/owner/resale-requests"
                  >
                    Manage Resales
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="hidden sm:block">
              <ConnectButton
                showBalance={{
                  smallScreen: true,
                  largeScreen: true,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}