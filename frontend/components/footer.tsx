import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { FaXTwitter } from "react-icons/fa6";
import { FaGithub } from "react-icons/fa6";

export function Footer({ showText }: { showText?: boolean }) {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-screen-xl px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        {showText && (
          <div className=" flex flex-col items-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-5xl">
              Rexell
            </h2>

            <p className="mx-auto mt-4 max-w-sm text-gray-500 hidden md:block">
              Connect your wallet to get started
            </p>

            <div className="mt-8 hidden md:block ">
              <ConnectButton />
            </div>
          </div>
        )}

        <div className="mt-16 border-t border-gray-100 pt-8 sm:flex sm:items-center sm:justify-between lg:mt-24">
          <ul className="flex flex-wrap justify-center gap-4 text-xs lg:justify-end">
            <li>
              <a href="#" className="text-gray-500 transition hover:opacity-75">
                {" "}
                Terms & Conditions{" "}
              </a>
            </li>

            <li>
              <a href="#" className="text-gray-500 transition hover:opacity-75">
                {" "}
                Privacy Policy{" "}
              </a>
            </li>

            <li>
              <a href="#" className="text-gray-500 transition hover:opacity-75">
                {" "}
                Cookies{" "}
              </a>
            </li>
          </ul>

          <ul className="mt-8 flex justify-center gap-6 sm:mt-0 lg:justify-end">
            <li>
              <a
                href="#"
                rel="noreferrer"
                target="_blank"
                className="text-gray-700 transition hover:opacity-75"
              >
                <span className="sr-only">Twitter</span>

                <FaXTwitter className="h-6 w-6" />
              </a>
            </li>

            <li>
              <Link
                href="https://github.com/jeffIshmael/web3Tickets"
                rel="noreferrer"
                target="_blank"
                className="text-gray-700 transition hover:opacity-75"
              >
                <span className="sr-only">GitHub</span>

                <FaGithub className="h-6 w-6" />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
