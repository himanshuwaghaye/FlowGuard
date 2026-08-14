import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ROLE_HOME, ROLE_LABEL, useApp, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with OTP — FlowGuard Traffic Control" },
      {
        name: "description",
        content:
          "Verify your mobile or email with a 6-digit OTP and choose your FlowGuard role: citizen, police, ambulance or planning authority.",
      },
      { property: "og:title", content: "Sign in with OTP — FlowGuard" },
      {
        property: "og:description",
        content: "OTP verification and role-based access for the FlowGuard traffic platform.",
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

  useEffect(() => {
    const t = setInterval(() => {
      setTtl((v) => Math.max(0, v - 1));
      setCooldown((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const valid = /^(\+?\d[\d\s-]{7,14}|[^@\s]+@[^@\s]+\.[a-z]{2,})$/i.test(contact.trim());

  function sendOtp() {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setIssued(otp);
    setTtl(OTP_TTL);
    setCooldown(RESEND_COOLDOWN);
    setStep("otp");
    toast.info(`Demo OTP: ${otp}`, {
      description: "Connect a backend to deliver this by SMS or email.",
      duration: 12000,
    });
  }

  function verify(value: string) {
    if (ttl === 0) {
      toast.error("Code expired — request a new one.");
      return;
    }
    if (value !== issued) {
      toast.error("Incorrect code.");
      return;
    }
    const existing = accountFor(contact.trim());
    if (existing) {
      signIn(existing.contact, existing.role, existing.badgeId);
      toast.success(`Welcome back — ${ROLE_LABEL[existing.role]} access`);
      navigate({ to: ROLE_HOME[existing.role] });
      return;
    }
    setStep("role");
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
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="font-semibold">FlowGuard</span>
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
            {["6-digit OTP, expires in 5 minutes", "Role stored with the account", "Badge/department verification for responders"].map(
              (t) => (
                <li key={t} className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-flow" /> {t}
                </li>
              ),
            )}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Demo mode — OTP delivery and account storage require a connected backend.
        </p>
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
                <h2 className="text-xl font-semibold">Sign in</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We'll send a 6-digit code to verify it's you.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Mobile number or email</Label>
                <Input
                  id="contact"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={contact}
                  maxLength={64}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && valid && sendOtp()}
                />
              </div>
              <Button className="w-full" disabled={!valid || !ready} onClick={sendOtp}>
                Send code
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Enter the code</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sent to <span className="text-foreground">{contact}</span>
                </p>
              </div>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) verify(v);
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
                    ? `expires in ${String(Math.floor(ttl / 60)).padStart(2, "0")}:${String(ttl % 60).padStart(2, "0")}`
                    : "code expired"}
                </span>
                <button
                  disabled={cooldown > 0}
                  onClick={sendOtp}
                  className="disabled:opacity-40 hover:text-foreground"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
              <Button className="w-full" disabled={code.length !== 6} onClick={() => verify(code)}>
                Verify
              </Button>
            </div>
          )}

          {step === "role" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Choose your role</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You'll land here every time you sign in.
                </p>
              </div>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={cn(
                      "w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent",
                      role === r.id && "border-primary bg-accent",
                    )}
                  >
                    <div className="text-sm font-medium">{ROLE_LABEL[r.id]}</div>
                    <div className="text-xs text-muted-foreground">{r.blurb}</div>
                  </button>
                ))}
              </div>
              {ROLES.find((r) => r.id === role)!.needsBadge && (
                <div className="space-y-2">
                  <Label htmlFor="badge">Badge ID / department code</Label>
                  <Input
                    id="badge"
                    value={badge}
                    maxLength={24}
                    placeholder="e.g. TP-4482"
                    onChange={(e) => setBadge(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Auto-validated in demo mode. Connect a backend for real department review.
                  </p>
                </div>
              )}
              <Button className="w-full" onClick={finish}>
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
