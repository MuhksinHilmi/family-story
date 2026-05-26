"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OtpInput } from "@/components/ui/otp-input";
import { rootStyles } from "@/components/ui/design-system";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setStep("otp");
        setCountdown(60);
      } else {
        const data = await response.json();
        setError(data.error || "Gagal mengirim OTP");
      }
    } catch (error) {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpComplete = async (value: string) => {
    if (value.length !== 6) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: value }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        const next = searchParams.get('next') || '/feeds';
        // decode next if it was encoded earlier
        const destination = next ? decodeURIComponent(next) : '/feeds';
        window.location.href = destination;
      } else {
        setError(data.error || "OTP salah");
      }
    } catch (error) {
      setError("Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    await handleVerifyOtpComplete(otp);
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || !email) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setCountdown(60);
        setOtp("");
      } else {
        const data = await response.json();
        setError(data.error || "Gagal mengirim ulang OTP");
      }
    } catch (error) {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{rootStyles}</style>
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md lp-card">
          {step === "email" ? (
            <>
              <CardHeader className="card-header">
                <CardTitle>Masuk</CardTitle>
                <CardDescription>
                  Masukkan email untuk menerima kode OTP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-[#D4C4A8] bg-[#EDE4D3] px-3 py-2 text-base text-[#3B2F1E] ring-offset-white placeholder:text-[#9C8B75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Mengirim..." : "Kirim Kode OTP"}
                  </Button>
                  <div className="mt-4 text-center">
                    <Link
                      href="/auth/register"
                      className="text-sm text-[#4A7C59] hover:underline"
                    >
                      Belum punya akun? Daftar di sini
                    </Link>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="card-header">
                <CardTitle>Masukkan Kode OTP</CardTitle>
                <CardDescription>
                  Kode OTP telah dikirim ke {email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    onComplete={handleVerifyOtpComplete}
                    disabled={isLoading}
                  />
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || isLoading}
                      className="text-sm text-[#4A7C59] hover:underline disabled:opacity-50"
                    >
                      {isLoading
                        ? "Mengirim..."
                        : countdown > 0
                          ? `Kirim ulang dalam ${countdown}s`
                          : "Kirim ulang kode OTP"}
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setStep("email")}
                      className="text-sm text-[#9C8B75] hover:underline"
                    >
                      Gunakan email lain
                    </button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
