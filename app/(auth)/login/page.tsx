"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Truck, Mail, Lock, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/layout/theme-provider";
import { useTranslation } from "@/components/layout/language-provider";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { isWeakPassword } from "@/lib/auth-utils";
import {
  sendResetPasswordOtpAction,
  verifyResetPasswordOtpAction,
  resetPasswordWithOtpAction
} from "@/actions/password-reset";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();

  // Forgot Password flow states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const handleSendOtp = async () => {
    if (!resetEmail || !resetEmail.includes("@")) {
      setResetError("Please enter a valid email address.");
      return;
    }
    setIsResetLoading(true);
    setResetError(null);
    try {
      const res = await sendResetPasswordOtpAction(resetEmail);
      if (res.error) {
        setResetError(res.error);
      } else {
        setResetStep(2);
      }
    } catch (err) {
      setResetError("Failed to send OTP code.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (resetOtp.length !== 6 || isNaN(Number(resetOtp))) {
      setResetError("Please enter the 6-digit code.");
      return;
    }
    setIsResetLoading(true);
    setResetError(null);
    try {
      const res = await verifyResetPasswordOtpAction(resetEmail, resetOtp);
      if (res.error) {
        setResetError(res.error);
      } else {
        setResetStep(3);
      }
    } catch (err) {
      setResetError("Verification failed.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetError(null);
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setResetError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setResetError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setResetError("Password must contain at least one number.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      setResetError("Password must contain at least one special character.");
      return;
    }
    if (isWeakPassword(newPassword)) {
      setResetError("Simple or weak passwords are not accepted.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsResetLoading(true);
    try {
      const res = await resetPasswordWithOtpAction(resetEmail, resetOtp, newPassword);
      if (res.error) {
        setResetError(res.error);
      } else {
        setResetSuccess("Password reset successful! You can now log in.");
        setTimeout(() => {
          setIsResetModalOpen(false);
          setResetStep(1);
          setResetEmail("");
          setResetOtp("");
          setNewPassword("");
          setConfirmNewPassword("");
          setResetError(null);
          setResetSuccess(null);
        }, 2000);
      }
    } catch (err) {
      setResetError("Failed to reset password.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const logoSrc = theme === "dark" ? "/logo.png" : "/logo1.png";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (result?.error) {
        setError("Invalid username or password");
        setIsLoading(false);
      } else {
        router.refresh();
        router.push("/");
      }
    } catch (err) {
      console.error("Login unexpected error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-zinc-100 via-white to-amber-50/30 px-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-amber-950/10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Smart Force Taxi",
            "url": "http://localhost:3000",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "All",
            "description": "Enterprise-grade Fleet Management System for vehicle tracking, driver scheduling, and maintenance logging.",
            "provider": {
              "@type": "Organization",
              "name": "Smart Force Taxi"
            }
          })
        }}
      />
      <Card className="w-full max-w-md border-border glass glow-primary relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center gap-1 border-r border-border pr-2 text-xs">
            <button
              onClick={() => setLanguage("en")}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors",
                language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted"
              )}
              type="button"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("fi")}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors",
                language === "fi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted"
              )}
              type="button"
            >
              FI
            </button>
          </div>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={toggleTheme} type="button">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-auto items-center justify-center mb-2">
            <img 
              src={logoSrc} 
              alt="Smart Force Taxi Logo" 
              className="h-12 w-auto object-contain dark:brightness-110"
            />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{t("welcome_login")}</CardTitle>
          <CardDescription>
            {t("enter_credentials")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">
                {t("email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-10"
                  disabled={isLoading}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">
                  {t("password")}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(true);
                    setResetStep(1);
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-600 hover:underline cursor-pointer bg-transparent border-none p-0 focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  disabled={isLoading}
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sign_in")}...
                </>
              ) : (
                t("sign_in")
              )}
            </Button>
          </form>

          {/* <div className="mt-4 text-center text-xs">
            <span className="text-muted-foreground">{t("dont_have_account")} </span>
            <a href="/register" className="text-primary font-semibold hover:underline">
              {t("register_now")}
            </a>
          </div>   */}

          {/* Quick Access Info for Testing */}
          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-[11px] text-muted-foreground">Admin Credentials:</p>
            <div className="mt-2 text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
              <div>
                <span className="font-semibold block text-foreground">Admin Portal</span>
                admin@mattengg.com<br />Matt@4321admin
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Modal Dialog */}
      {isResetModalOpen && (
        <Dialog
          isOpen={isResetModalOpen}
          onClose={() => {
            setIsResetModalOpen(false);
            setResetStep(1);
            setResetEmail("");
            setResetOtp("");
            setNewPassword("");
            setConfirmNewPassword("");
            setResetError(null);
            setResetSuccess(null);
          }}
          title="Forgot Password"
          className="max-w-sm"
        >
          <div className="space-y-4 pt-2">
            {resetError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 font-semibold leading-relaxed">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 font-semibold leading-relaxed">
                {resetSuccess}
              </div>
            )}

            {/* Step 1: Enter Email */}
            {resetStep === 1 && !resetSuccess && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your registered driver email address to receive a 6-digit OTP verification code.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="john.doe@company.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={isResetLoading}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsResetModalOpen(false)}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendOtp}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 border-none"
                  >
                    {isResetLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "OK"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Enter OTP */}
            {resetStep === 2 && !resetSuccess && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A verification code has been sent to <strong>{resetEmail}</strong>. Please enter the 6-digit code below.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Verification Code</label>
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    disabled={isResetLoading}
                    className="text-center tracking-widest font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetStep(1)}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-semibold"
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleVerifyOtp}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 border-none"
                  >
                    {isResetLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "OK"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Enter New Password & Confirm Password */}
            {resetStep === 3 && !resetSuccess && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set a new secure password. The password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isResetLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none bg-transparent border-none p-0 flex items-center justify-center"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Confirm Password</label>
                    <div className="relative">
                      <Input
                        type={showConfirmNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        disabled={isResetLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none bg-transparent border-none p-0 flex items-center justify-center"
                      >
                        {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetStep(2)}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-semibold"
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleResetPassword}
                    disabled={isResetLoading}
                    className="text-xs cursor-pointer font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 border-none"
                  >
                    {isResetLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "OK"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
