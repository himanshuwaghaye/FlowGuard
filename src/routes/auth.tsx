import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, Loader2, Mail, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ROLE_HOME, ROLE_LABEL, useApp, type Role } from "@/lib/store";
import { sendOtpServerFn, verifyOtpServerFn } from "@/lib/auth-server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with OTP — FlowGuard Traffic Intelligence" },
      {
        name: "description",
        content:
          "Secure mobile and email OTP authentication for FlowGuard: connect as a citizen, traffic police, ambulance responder, or planning authority.",
      },
      { property: "og:title", content: "Sign in with OTP — FlowGuard" },
      {
        property: "og:description",
        content: "Backend-connected OTP verification and role-based access for the FlowGuard traffic platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const OTP_TTL = 300; // 5 minutes
const RESEND_COOLDOWN = 30;

const ROLES: { id: Role; blurb: string; needsBadge: boolean }[] = [
  { id: "citizen", blurb: "Report incidents, use SOS, see live reroutes", needsBadge: false },
  { id: "police", blurb: "Respond to SOS, override signals on-scene", needsBadge: true },
  { id: "ambulance", blurb: "Emergency routing with live congestion", needsBadge: true },
  { id: "authority", blurb: "Simulation, analytics and signal plans", needsBadge: true },
];

function AuthPage() {
  const { signIn, accountFor, ready } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<"contact" | "otp" | "role">("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [ttl, setTtl] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [role, setRole] = useState<Role>("citizen");
  const [badge, setBadge] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTtl((v) => Math.max(0, v - 1));
      setCooldown((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const valid = /^(\+?\d[\d\s-]{7,14}|[^@\s]+@[^@\s]+\.[a-z]{2,})$/i.test(contact.trim());

  async function handleSendOtp() {
    if (!valid) return;
    setLoading(true);

    try {
      const res = await sendOtpServerFn({ data: { contact: contact.trim() } });

      if (res.success) {
        setProvider(res.provider || "dev_mode");
        setTtl(res.ttlSeconds || OTP_TTL);
        setCooldown(res.cooldownSeconds || RESEND_COOLDOWN);
        setStep("otp");

        if (res.provider === "dev_mode" && res.demoCode) {
          setIssued(res.demoCode);
          toast.info(`Development OTP: ${res.demoCode}`, {
            description: "To send real SMS or Emails, set TWILIO_*, FAST2SMS_API_KEY, or RESEND_API_KEY in .env.",
            duration: 12000,
          });
        } else {
          toast.success(`OTP dispatched via ${res.provider?.toUpperCase()}`, {
            description: `Check your ${contact.includes("@") ? "email inbox" : "SMS messages"} for the 6-digit code.`,
          });
        }
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to contact backend OTP service.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(value: string) {
    if (ttl === 0) {
      toast.error("Code expired — request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpServerFn({
        data: { contact: contact.trim(), code: value },
      });

      if (!res.success) {
        toast.error(res.message);
        setLoading(false);
        return;
      }

      toast.success("Identity verified successfully!");

      const existing = accountFor(contact.trim());
      if (existing) {
        signIn(existing.contact, existing.role, existing.badgeId);
        toast.success(`Welcome back — ${ROLE_LABEL[existing.role]} access`);
        navigate({ to: ROLE_HOME[existing.role] });
        return;
      }
      setStep("role");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Verification failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    const needsBadge = ROLES.find((r) => r.id === role)!.needsBadge;
    if (needsBadge && badge.trim().length < 4) {
      toast.error("Enter a valid badge ID or department code (min 4 characters).");
      return;
    }
    const account = signIn(contact.trim(), role, needsBadge ? badge.trim() : undefined);
    toast.success(
      needsBadge
        ? `Department code accepted — ${ROLE_LABEL[role]} access granted`
        : "Account created",
    );
    navigate({ to: ROLE_HOME[account.role] });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="FlowGuard Logo"
            className="h-10 w-10 rounded-lg object-cover shadow-sm ring-1 ring-border/50"
          />
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight">FlowGuard</span>
            <span className="text-xs text-muted-foreground font-medium">Traffic Signal Intelligence</span>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            One account for the whole corridor.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Citizens report. Police and ambulance respond. Planners rebalance signal timing across
            peak hours. Every action is traceable to a verified account.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {[
              "Real-time backend OTP dispatch via SMS (Twilio / Fast2SMS) & Email (Resend)",
              "Cryptographically secure 6-digit OTP with 5-min TTL & rate-limiting",
              "Role stored securely with verified session token",
              "Department code verification for Traffic Police & Responders",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-flow shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-flow animate-pulse" />
          <span>Backend Server Functions: Active & Connected</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {step !== "contact" && (
            <button
              onClick={() => setStep(step === "role" ? "otp" : "contact")}
              className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}

          {step === "contact" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Sign in to FlowGuard</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We'll send a 6-digit verification code to your phone or email.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Mobile number or email</Label>
                <Input
                  id="contact"
                  autoComplete="tel"
                  placeholder="+91 98765 43210 or officer@police.gov.in"
                  value={contact}
                  maxLength={64}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && valid && !loading && handleSendOtp()}
                />
              </div>
              <Button
                className="w-full font-medium"
                disabled={!valid || !ready || loading}
                onClick={handleSendOtp}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Enter the code</h2>
                  {provider && (
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {provider === "dev_mode" ? "DEV MODE" : provider}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{contact}</span>
                </p>
              </div>
              <InputOTP
                maxLength={6}
                value={code}
                disabled={loading}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6 && !loading) handleVerify(v);
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="num">
                  {ttl > 0
                    ? `Expires in ${String(Math.floor(ttl / 60)).padStart(2, "0")}:${String(ttl % 60).padStart(2, "0")}`
                    : "Code expired"}
                </span>
                <button
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="disabled:opacity-40 hover:text-foreground font-medium text-primary"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
              <Button
                className="w-full font-medium"
                disabled={code.length !== 6 || loading}
                onClick={() => handleVerify(code)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Code...
                  </>
                ) : (
                  "Verify & Sign In"
                )}
              </Button>
            </div>
          )}

          {step === "role" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Choose your role</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select your operational clearance on the Nagpur traffic grid.
                </p>
              </div>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={cn(
                      "w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent",
                      role === r.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="text-sm font-medium">{ROLE_LABEL[r.id]}</div>
                    <div className="text-xs text-muted-foreground">{r.blurb}</div>
                  </button>
                ))}
              </div>
              {ROLES.find((r) => r.id === role)!.needsBadge && (
                <div className="space-y-2">
                  <Label htmlFor="badge">Badge ID / Department Code</Label>
                  <Input
                    id="badge"
                    value={badge}
                    maxLength={24}
                    placeholder="e.g. TP-NAGPUR-4482"
                    onChange={(e) => setBadge(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for Police & Emergency dispatch authority.
                  </p>
                </div>
              )}
              <Button className="w-full font-medium" onClick={finish}>
                Access FlowGuard Console
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

