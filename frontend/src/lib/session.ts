// Session helpers — Supabase Auth is the target identity authority;
// this module owns the "me" query, Supabase session handling,
// and the invalidation that follows login/signup/logout.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  supabaseLogin,
  supabaseLogout,
  supabaseSignup,
  supabaseSubmitPasswordReset,
  supabaseVerifyForgotPasswordOtp,
} from "./supabaseClient";
import type { AuthOut, User } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      try {
        const { data: userRecord } = await supabase
          .from("users")
          .select("*")
          .or(`supabase_auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
          .maybeSingle();

        if (userRecord) {
          return {
            id: userRecord.id,
            email: userRecord.email,
            phone: userRecord.phone,
            name: userRecord.name,
            roles: userRecord.roles || ["customer"],
            referral_code: userRecord.referral_code || null,
            referred_by: userRecord.referred_by || null,
            phone_verified: userRecord.phone_verified ?? true,
            is_active: userRecord.is_active ?? true,
            created_at: userRecord.created_at || new Date().toISOString(),
          } as User;
        }
      } catch (_e) {
        // fallback to session user metadata below
      }

      const meta = session.user.user_metadata || {};
      return {
        id: session.user.id,
        email: session.user.email || "",
        phone: session.user.phone || meta.phone || "",
        name: meta.name || session.user.email?.split("@")[0] || "Customer",
        roles: meta.roles || ["customer"],
        referral_code: meta.referral_code || null,
        phone_verified: true,
        is_active: true,
      } as User;
    },
  });
}

export const login = async (identifier: string, password: string): Promise<AuthOut> => {
  return await supabaseLogin(identifier, password);
};

export const signup = async (body: {
  email: string;
  name: string;
  password: string;
  phone: string;
  referral_code?: string | null;
  consent?: boolean;
  msg91_verification_token?: string | null;
  msg91_request_id?: string | null;
}): Promise<AuthOut> => {
  return await supabaseSignup(body);
};

export const logout = async (): Promise<{ ok: boolean }> => {
  await supabaseLogout();
  return { ok: true };
};

export const verifyForgotPasswordOtp = async (body: {
  phone: string;
  msg91_verification_token: string;
  msg91_request_id?: string | null;
}): Promise<{ ok: boolean; reset_token: string; message: string }> => {
  return await supabaseVerifyForgotPasswordOtp(body);
};

export const submitPasswordReset = async (body: {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ ok: boolean; message: string }> => {
  return await supabaseSubmitPasswordReset(body);
};

export function useSessionInvalidator() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["referrals"] });
  };
}

export const isStaff = (user: User | null | undefined): boolean =>
  !!user &&
  user.roles.some((r) =>
    [
      "owner",
      "admin",
      "manager",
      "crm_master",
      "crm_manager",
      "crm_employee",
    ].includes(r)
  );
