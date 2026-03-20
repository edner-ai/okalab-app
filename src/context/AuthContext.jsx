import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getContactProfileState } from "../utils/contactProfile";

const AuthContext = createContext(null);

const normalizeRole = (value) => (typeof value === "string" ? value.toLowerCase() : "");

function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stableRole, setStableRole] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const mountedRef = useRef(true);
  const syncInFlightRef = useRef(false);
  const lastUserIdRef = useRef(null);

  const clearAuthState = useCallback(() => {
    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthLoading(false);
    setProfileLoading(false);
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const req = supabase
        .from("profiles")
        .select(
          "id, full_name, email, avatar_url, bio, phone, whatsapp_number, whatsapp_enabled, preferred_contact_method, allow_teacher_contact, allow_admin_contact, allow_student_contact, location, country_code, preferred_language, preferred_payout_method, payout_paypal_email, payout_bank_account_name, payout_bank_name, payout_bank_account_number, payout_bank_iban, payout_bank_swift, payout_mobile_wallet_full_name, payout_mobile_wallet_phone, role, verification_status, is_verified, updated_at"
        )
        .eq("id", userId)
        .maybeSingle();
      const { data, error } = await withTimeout(req, 15000, "fetchProfile timeout");
      if (error?.message?.includes("timeout")) {
        const retry = await withTimeout(req, 15000, "fetchProfile timeout retry");
        return { data: retry?.data ?? null, error: retry?.error ?? null };
      }
      return { data: data ?? null, error: error ?? null };
    } catch (error) {
      return { data: null, error: error ?? new Error("fetchProfile failed") };
    }
  }, []);

  const createProfileIfMissing = useCallback(async (authUser) => {
    if (!authUser?.id) return null;
    try {
      const preferredLanguage = localStorage.getItem("preferred_language") || "es";
      const { error } = await supabase.rpc("ensure_my_profile", {
        p_preferred_language: preferredLanguage,
      });

      if (error) {
        console.warn("ensureMyProfile error:", error?.message || error);
        return null;
      }

      const retry = await fetchProfile(authUser.id);
      if (retry?.error) {
        console.warn("fetchProfile after ensureMyProfile error:", retry.error?.message || retry.error);
        return null;
      }

      return retry?.data ?? null;
    } catch (error) {
      console.warn("ensureMyProfile error:", error?.message || error);
      return null;
    }
  }, [fetchProfile]);

  const applyProfile = useCallback((nextProfile, userId) => {
    if (!mountedRef.current) return;
    if (nextProfile) {
      setProfile(nextProfile);
      return;
    }
    setProfile((prev) => (prev?.id === userId ? prev : null));
  }, []);

  const resolveValidSession = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let currentSession = sessionData?.session ?? null;
    if (!currentSession?.access_token) return { session: null, user: null };

    let { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(currentSession.access_token),
      15000,
      "getUser timeout"
    );

    if (userError || !userData?.user) {
      const { data: refreshData, error: refreshError } = await withTimeout(
        supabase.auth.refreshSession(),
        15000,
        "refreshSession timeout"
      );
      currentSession = refreshData?.session ?? null;
      if (refreshError || !currentSession?.access_token) return { session: null, user: null };

      const validated = await withTimeout(
        supabase.auth.getUser(currentSession.access_token),
        15000,
        "getUser timeout after refresh"
      );
      userData = validated.data;
      userError = validated.error;
      if (userError || !userData?.user) return { session: null, user: null };
    }

    return { session: currentSession, user: userData.user };
  }, []);

  const sync = useCallback(
    async (reason = "sync", { silent = false } = {}) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      if (!silent) {
        setAuthLoading(true);
        setProfileLoading(true);
      }

      try {
        const { session: validSession, user: validUser } = await resolveValidSession();
        if (!mountedRef.current) return;

        if (!validSession || !validUser) {
          clearAuthState();
          return;
        }

        setSession(validSession);
        setUser(validUser);
        setAuthLoading(false);

        const profileResult = await fetchProfile(validUser.id);
        if (!mountedRef.current) return;
        let nextProfile = profileResult?.data ?? null;
        if (profileResult?.error) {
          console.warn("fetchProfile error:", profileResult.error?.message || profileResult.error);
        }
        if (!nextProfile && !profileResult?.error) {
          const created = await createProfileIfMissing(validUser);
          nextProfile = created || null;
        }
        applyProfile(nextProfile, validUser.id);
      } catch (e) {
        console.warn(`auth sync error (${reason}):`, e?.message || e);
        if (mountedRef.current) {
          setAuthLoading(false);
          setProfileLoading(false);
        }
      } finally {
        if (mountedRef.current) {
          setProfileLoading(false);
        }
        syncInFlightRef.current = false;
      }
    },
    [clearAuthState, fetchProfile, resolveValidSession, createProfileIfMissing]
  );

  const signOut = useCallback(async () => {
    // Optimistic logout: clear UI immediately, then revoke local session.
    clearAuthState();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("signOut error:", error?.message || error);
    }
  }, [clearAuthState]);

  useEffect(() => {
    mountedRef.current = true;

    sync("init");

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return;

      if (!nextSession?.access_token) {
        clearAuthState();
        return;
      }

      try {
        const { data: authData, error: authError } = await withTimeout(
          supabase.auth.getUser(nextSession.access_token),
          6000,
          "getUser timeout on auth state change"
        );

        if (authError || !authData?.user) {
          await sync("auth-state-recover");
          return;
        }

        setSession(nextSession);
        setUser(authData.user);
        setAuthLoading(false);

        const profileResult = await fetchProfile(authData.user.id);
        if (!mountedRef.current) return;
        let nextProfile = profileResult?.data ?? null;
        if (profileResult?.error) {
          console.warn("fetchProfile error:", profileResult.error?.message || profileResult.error);
        }
        if (!nextProfile && !profileResult?.error) {
          const created = await createProfileIfMissing(authData.user);
          nextProfile = created || null;
        }
        applyProfile(nextProfile, authData.user.id);
        setProfileLoading(false);
      } catch {
        clearAuthState();
      }
    });

    return () => {
      mountedRef.current = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [clearAuthState, fetchProfile, sync, createProfileIfMissing, applyProfile]);

  useEffect(() => {
    const currentId = user?.id || null;
    if (!currentId) {
      lastUserIdRef.current = null;
      setStableRole("");
      return;
    }
    if (lastUserIdRef.current && lastUserIdRef.current !== currentId) {
      setStableRole("");
    }
    lastUserIdRef.current = currentId;
  }, [user?.id]);

  const roleFromProfile = normalizeRole(profile?.role);
  const roleFromMeta = normalizeRole(user?.user_metadata?.role || user?.app_metadata?.role);
  useEffect(() => {
    const nextRole = roleFromProfile || roleFromMeta;
    if (nextRole) setStableRole(nextRole);
  }, [roleFromProfile, roleFromMeta]);

  const resolvedRole = roleFromProfile || roleFromMeta || stableRole;
  const role = resolvedRole || (user ? "unknown" : "guest");
  const roleReady = !!resolvedRole || !user;
  const verificationStatus = (profile?.verification_status || "none").toLowerCase();
  const isVerified = profile?.is_verified === true || profile?.is_verified === "true";

  const isTeacherRole = role === "teacher" || role === "professor";
  const canCreateSeminar =
    role === "admin" || isTeacherRole || isVerified || verificationStatus === "approved";
  const isAdmin = role === "admin";
  const contactProfileState = useMemo(() => getContactProfileState(profile, user), [profile, user]);
  const contactProfileComplete = contactProfileState.isComplete;

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      authLoading,
      profileLoading,
      loading: authLoading || profileLoading,
      role,
      roleReady,
      isAdmin,
      canCreateSeminar,
      contactProfileState,
      contactProfileComplete,
      refresh: () => sync("manual"),
      signOut,
    }),
    [
      session,
      user,
      profile,
      authLoading,
      profileLoading,
      role,
      isAdmin,
      canCreateSeminar,
      contactProfileState,
      contactProfileComplete,
      sync,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
