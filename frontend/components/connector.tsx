"use client";

import { useEffect } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function Connector({ children }: { children: React.ReactNode }) {
  const { connect } = useConnect();

  useEffect(() => {
    connect({ connector: injected() });
  }, [connect]);

  return <div>{children}</div>;
}
