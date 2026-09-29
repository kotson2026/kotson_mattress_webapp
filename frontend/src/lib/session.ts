// Session helpers — sessions are httpOnly cookies; this module owns the "me" query
// and the invalidation that must follow login/signup/logout.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { AuthOut, User } from "@/lib/types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<User | null>("/auth/me") });
}

export const login = (identifier: string, password: string) =>
  apiPost<AuthOut>("/auth/login", { identifier, password });

export const signup = (body: {
  email: string;
  name: string;
  password: string;
  phone: string;
  referral_code?: string | null;
  consent?: boolean;
  msg91_verification_token?: string | null;
  msg91_request_id?: string | null;
}) => apiPost<AuthOut>("/auth/signup", body);


export const logout = () => apiPost<{ ok: boolean }>("/auth/logout");

export const verifyForgotPasswordOtp = (body: {
  phone: string;
  msg91_verification_token: string;
  msg91_request_id?: string | null;
}) =>
  apiPost<{ ok: boolean; reset_token: string; message: string }>(
    "/auth/forgot-password/verify",
    body
  );

export const submitPasswordReset = (body: {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}) =>
  apiPost<{ ok: boolean; message: string }>("/auth/forgot-password/reset", body);


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
  !!user && user.roles.some((r) => ["owner", "admin", "manager", "crm_master", "crm_manager", "crm_employee"].includes(r));
