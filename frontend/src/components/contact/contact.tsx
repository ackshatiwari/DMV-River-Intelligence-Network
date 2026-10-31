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
        <main className="min-h-screen bg-page text-ink">
            <section className="mx-auto max-w-3xl px-6 py-12">
                <div className="rounded-3xl border border-line bg-panel p-8">
                    <div className="mb-8 space-y-3">
                        <h1 className="text-3xl font-bold text-ink">Contact Us</h1>
                        <p className="text-base text-ink-muted">
                            Use the form below to send us a message. We will try to respond to your query within <span className="font-medium">3 business days</span>.
                        </p>
                    </div>

                    <form className="grid gap-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium text-ink">
                                First name
                                <input
                                    className="rounded-2xl border border-line bg-page px-4 py-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                                    value={form.firstName}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, firstName: event.target.value })}
                                    required
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-medium text-ink">
                                Last name
                                <input
                                    className="rounded-2xl border border-line bg-page px-4 py-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                                    value={form.lastName}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, lastName: event.target.value })}
                                    required
                                />
                            </label>
                        </div>  

                        <label className="grid gap-2 text-sm font-medium text-ink">
                            Email Address
                            <input
                                type="email"
                                className="rounded-2xl border border-line bg-page px-4 py-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                                value={form.email}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: event.target.value })}
                                required
                            />
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-ink">
                            Message
                            <textarea
                                className="min-h-40 rounded-2xl border border-line bg-page px-4 py-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                                value={form.message}
                                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, message: event.target.value })}
                                required
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={status === "sending"}
                            className="inline-flex items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-page transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink-muted"
                        >
                            {status === "sending" ? "Sending..." : "Send message"}
                        </button>

                        {feedback ? (
                            <p className={status === "error" ? "text-sm font-medium text-danger" : "text-sm font-medium text-success"}>
                                {feedback}
                            </p>
                        ) : null}
                    </form>
                </div>
            </section>
        </main>
    );
}