"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    text: string;
    sources?: string[];
}

const SUGGESTIONS = [
    "How does ticket resale work?",
    "How does Rexell stop bots and scalpers?",
    "How do I buy a ticket with cUSD?",
];

/**
 * Floating Rexell assistant. Calls the same-origin /api/ai/assistant proxy,
 * which forwards to the ai-insights RAG service.
 */
export function Assistant() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            text: "Hi! I'm the Rexell assistant. Ask me about events, tickets, resale rules or bot protection.",
        },
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    const send = async (question: string) => {
        const q = question.trim();
        if (!q || loading) return;
        setMessages((m) => [...m, { role: "user", text: q }]);
        setInput("");
        setLoading(true);
        try {
            const resp = await fetch("/api/ai/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: q }),
            });
            const data = await resp.json();
            setMessages((m) => [
                ...m,
                { role: "assistant", text: data.answer || "No answer available.", sources: data.sources },
            ]);
        } catch {
            setMessages((m) => [...m, { role: "assistant", text: "Sorry, I'm offline right now." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Launcher */}
            <button
                aria-label="Open Rexell assistant"
                onClick={() => setOpen((o) => !o)}
                className="fixed bottom-20 right-4 sm:bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
            >
                {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>

            {open && (
                <div className="fixed bottom-36 right-4 sm:bottom-24 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
                    <div className="flex items-center gap-2 bg-blue-600 px-4 py-3 text-white">
                        <Bot className="h-5 w-5" />
                        <span className="font-semibold">Rexell Assistant</span>
                    </div>

                    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
                        {messages.map((m, i) => (
                            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                                <div
                                    className={
                                        "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm " +
                                        (m.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 text-gray-800")
                                    }
                                >
                                    {m.text}
                                    {m.sources && m.sources.length > 0 && (
                                        <div className="mt-1 text-[10px] text-gray-500">
                                            Sources: {m.sources.join(", ")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="text-left">
                                <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                                </div>
                            </div>
                        )}
                        {messages.length <= 1 && (
                            <div className="space-y-1 pt-2">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="block w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs text-blue-800 hover:bg-blue-100"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            send(input);
                        }}
                        className="flex items-center gap-2 border-t p-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about Rexell…"
                            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
