import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("has_any_admin");
      if (cancelled) return;
      if (error) {
        // Fail open to setup; the bootstrap function itself enforces the rule.
        setHasAdmin(false);
      } else {
        setHasAdmin(!!data);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.setup.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("auth.setup.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (signUpError || !signUpData.user) {
        toast.error(signUpError?.message || t("auth.setup.errorGeneric"));
        setSubmitting(false);
        return;
      }

      // Ensure we have a session (auto-confirm should be on); if not, sign in.
      let userId = signUpData.user.id;
      if (!signUpData.session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !signInData.user) {
          toast.error(t("auth.setup.errorGeneric"));
          setSubmitting(false);
          return;
        }
        userId = signInData.user.id;
      }

      const { error: bootstrapError } = await supabase.rpc("bootstrap_first_admin", {
        _user_id: userId,
      });
      if (bootstrapError) {
        toast.error(bootstrapError.message || t("auth.setup.errorGeneric"));
        setSubmitting(false);
        return;
      }

      toast.success(t("auth.setup.success"));
      navigate("/admin");
    } catch {
      toast.error(t("auth.setup.errorGeneric"));
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <p className="text-sm text-secondary">{t("auth.setup.checking")}</p>
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="w-full max-w-sm p-8 rounded-xl bg-surface border border-border shadow-card text-center">
          <h1 className="text-2xl font-display font-medium">
            {t("auth.setup.alreadyConfigured")}
          </h1>
          <p className="text-sm text-secondary mt-2 mb-6">
            {t("auth.setup.alreadyConfiguredHint")}
          </p>
          <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90">
            <Link to="/admin/login">{t("auth.setup.goToLogin")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm p-8 rounded-xl bg-surface border border-border shadow-card"
      >
        <h1 className="text-2xl font-display font-medium">{t("auth.setup.title")}</h1>
        <p className="text-sm text-secondary mt-1 mb-6">{t("auth.setup.subtitle")}</p>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary">
              {t("auth.email")}
            </Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary">
              {t("auth.password")}
            </Label>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary">
              {t("auth.setup.confirmPassword")}
            </Label>
            <Input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-foreground text-background hover:bg-foreground/90"
            disabled={submitting}
          >
            {submitting ? t("auth.setup.creating") : t("auth.setup.create")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminSetup;
