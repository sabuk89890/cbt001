"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

export function LoginScreen() {
  const [username, setUsername] = useState("");
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
          username,
          password,
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
        user?: {
          role?: string;
        };
      };

      if (!response.ok) {
        setMessage(result.error ?? "Login gagal");
        return;
      }

      setMessage(result.message ?? "Login berhasil");

      const userRole = result.user?.role;
      if (userRole === "admin") {
        window.location.assign("/admin");
      }
    } catch {
      setMessage("Terjadi kesalahan saat menghubungi server");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-gradient-to-r from-sky-600 to-blue-800 px-6 py-7 text-white">
          <div className="flex items-center gap-4">
            <Image
              src="https://iili.io/fynLLYJ.png"
              alt="Logo CBT SMP Negeri 1 Bukit"
              width={64}
              height={64}
              className="h-14 w-14 rounded-full bg-white/10 object-contain p-1"
              priority
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-wide">CBT SMP Negeri 1 Bukit</h1>
              <p className="text-sm text-blue-100">Sistem Ujian Berbasis Komputer</p>
            </div>
          </div>
        </header>

        <section className="bg-slate-100 px-4 py-10">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-4xl font-semibold text-slate-700">Selamat Datang</h2>
            <p className="mt-2 text-lg text-slate-500">Silahkan login dengan akun yang Anda miliki</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-2 text-lg text-slate-700 outline-none focus:border-blue-600"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-2 text-lg text-slate-700 outline-none focus:border-blue-600"
                required
              />

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 w-full rounded-full bg-blue-600 px-5 py-3 text-xl font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Memproses..." : "Login"}
              </button>
            </form>

            {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

            <div className="mt-8 text-center text-sm text-slate-500">
              <p>@2026 EfKa Studio.</p>
              <p>Pengembang Feri Kurniawan, MP.d</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}