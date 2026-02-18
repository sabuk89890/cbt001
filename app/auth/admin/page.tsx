"use client";

import { FormEvent, useState } from "react";

export default function AdminAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: email,
          password,
          role: "admin",
        }),
      });

      const result = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Login gagal");
        return;
      }

      setMessage(result.message ?? "Login berhasil");
    } catch {
      setMessage("Terjadi kesalahan saat menghubungi server");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Login Admin</h1>
      <p className="text-sm opacity-80">
        Form login terhubung ke endpoint Supabase Auth dengan validasi role
        admin.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          {isLoading ? "Memproses..." : "Masuk sebagai Admin"}
        </button>
        {message ? <p className="text-sm">{message}</p> : null}
      </form>
    </main>
  );
}
