"use client";

import { useState } from "react";

type FormState = {
    firstName: string;
    lastName: string;
    email: string;
    message: string;
};

const initialFormState: FormState = {
    firstName: "",
    lastName: "",
    email: "",
    message: "",
};

export default function Contact() {
    // state for form field which is an object with firstName, lastName, email, and message properties
    const [form, setForm] = useState<FormState>(initialFormState);

    // state for form submission status and feedback message
    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

    // state for feedback message to display to the user after form submission
    const [feedback, setFeedback] = useState("");

    // handle form submission
    async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
        event.preventDefault();
        setStatus("sending");
        setFeedback("");

        try {
            console.log("Sending form data:", form);
            const response = await fetch("/api/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error sending form data:", data);
                throw new Error(data.error || "Something went wrong while sending the message.");
            }

            setStatus("success");
            setFeedback("Thanks for reaching out. Your message was sent successfully.");
            setForm(initialFormState);
        } catch (error) {
            setStatus("error");
            setFeedback(error instanceof Error ? error.message : "Something went wrong.");
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="mx-auto max-w-3xl px-6 py-12">
                <div className="rounded-3xl bg-white/90 p-8 shadow-lg ring-1 ring-black/5">
                    <div className="mb-8 space-y-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Contact</p>
                        <h1 className="text-3xl font-bold text-slate-900">Send the team a message</h1>
                        <p className="text-base text-slate-600">
                            Use the form below to send a message through Resend. Make sure your Resend API key and recipient email are set in <span className="font-medium">.env.local</span>.
                        </p>
                    </div>

                    <form className="grid gap-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                                First name
                                <input
                                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                    value={form.firstName}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, firstName: event.target.value })}
                                    required
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                                Last name
                                <input
                                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                    value={form.lastName}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, lastName: event.target.value })}
                                    required
                                />
                            </label>
                        </div>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                            Email
                            <input
                                type="email"
                                className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                value={form.email}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: event.target.value })}
                                required
                            />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                            Message
                            <textarea
                                className="min-h-40 rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                value={form.message}
                                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, message: event.target.value })}
                                required
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={status === "sending"}
                            className="inline-flex items-center justify-center rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {status === "sending" ? "Sending..." : "Send message"}
                        </button>

                        {feedback ? (
                            <p className={status === "error" ? "text-sm font-medium text-rose-600" : "text-sm font-medium text-emerald-700"}>
                                {feedback}
                            </p>
                        ) : null}
                    </form>
                </div>
            </section>
        </main>
    );
}