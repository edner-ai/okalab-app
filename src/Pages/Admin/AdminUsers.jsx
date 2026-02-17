import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Label } from "../../Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../Components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../Components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";
import { Card, CardContent } from "../../Components/ui/card";
import { Badge } from "../../Components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../Components/ui/dialog";

import { Search, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../Components/shared/LanguageContext";

function normalizeRole(profile) {
  return (profile?.role || "student").toLowerCase();
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get("tab") || "users");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab") || "users";
    const qParam = searchParams.get("q") || "";
    const roleParam = searchParams.get("role") || "all";

    if (tabParam !== tab) setTab(tabParam);
    if (qParam !== search) setSearch(qParam);
    if (roleParam !== roleFilter) setRoleFilter(roleParam);
  }, [searchParams.toString()]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (tab && tab !== "users") next.set("tab", tab);
    if (search) next.set("q", search);
    if (tab === "users" && roleFilter && roleFilter !== "all") {
      next.set("role", roleFilter);
    }
    setSearchParams(next, { replace: true });
  }, [tab, search, roleFilter, setSearchParams]);

  const {
    data: profiles = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-users", tab, search, roleFilter],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, preferred_language, bio, phone, location, verification_status, is_verified, updated_at"
        );

      if (tab === "pending") {
        // case-insensitive match in case there is a different casing or trailing spaces
        q = q.ilike("verification_status", "pending%");
      }

      if (tab === "users" && roleFilter !== "all") {
        q = q.eq("role", roleFilter);
      }

      const term = search.trim().replace(/,/g, " ");
      if (term) {
        const like = `%${term}%`;
        q = q.or(
          `full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},bio.ilike.${like}`
        );
      }

      const { data, error } = await q
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    onError: (err) => {
      toast.error(err?.message || t("admin_users_load_error", "Error al cargar usuarios"));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "approved",
          is_verified: true,
          role: "professor",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("admin_approve_success", "Aprobado"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error(t("admin_approve_error", "No se pudo aprobar")),
  });

  const rejectMutation = useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "rejected",
          is_verified: false,
          role: "student",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("admin_reject_success", "Rechazado"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error(t("admin_reject_error", "No se pudo rechazar")),
  });

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;

    setInviteLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;

      toast.success(t("admin_invite_sent", "Invitación enviada"));
      setInviteOpen(false);
      setInviteEmail("");
    } catch (e) {
      toast.error(e?.message || t("admin_invite_error", "No se pudo invitar"));
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("admin_users", "Users")}</h1>
          <p className="text-slate-500 text-sm">
            {t("admin_users_subtitle", "Manage the app's users and their roles")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800"
            onClick={() => setInviteOpen(true)}
          >
            {t("admin_invite_user", "Invite User")}
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          if (value !== "users") setRoleFilter("all");
        }}
      >
        <TabsList className="w-fit bg-slate-100">
          <TabsTrigger value="users">{t("admin_users", "Users")}</TabsTrigger>
          <TabsTrigger value="pending">{t("admin_pending_requests", "Pending requests")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t("admin_search_users", "Search by email or name")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {tab === "users" && (
                  <div className="min-w-[180px]">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin_all_roles", "All roles")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">{t("admin_all_roles", "All roles")}</SelectItem>
                        <SelectItem value="admin">{t("role_admin", "Admin")}</SelectItem>
                        <SelectItem value="professor">{t("role_professor", "Professor")}</SelectItem>
                        <SelectItem value="teacher">{t("role_teacher", "Teacher")}</SelectItem>
                        <SelectItem value="student">{t("role_student", "Student")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin_loading_users", "Loading users...")}
                </div>
              ) : isError ? (
                <div className="text-red-600 text-sm py-8">
                  {t("admin_users_load_error", "Error al cargar usuarios")}: {error?.message || t("common_unknown", "Desconocido")}
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-slate-500 text-sm py-10 text-center">
                  {t("common_no_results", "No results")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common_name", "Name")}</TableHead>
                      <TableHead>{t("common_role", "Role")}</TableHead>
                      <TableHead>{t("common_email", "Email")}</TableHead>
                      <TableHead>{t("common_language", "Language")}</TableHead>
                      <TableHead>{t("common_bio", "Bio")}</TableHead>
                      <TableHead>{t("common_phone", "Phone")}</TableHead>
                      {tab === "pending" ? <TableHead /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => {
                      const role = normalizeRole(p);
                      const isPending =
                        (p.verification_status || "").toLowerCase() ===
                        "pending";

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.full_name || t("common_no_name", "(No name)")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{role}</Badge>
                          </TableCell>
                          <TableCell className="truncate max-w-[220px]">
                            {p.email || "-"}
                          </TableCell>
                          <TableCell>{p.preferred_language || "-"}</TableCell>
                          <TableCell className="truncate max-w-[240px]">
                            {p.bio || "-"}
                          </TableCell>
                          <TableCell>{p.phone || "-"}</TableCell>
                          {tab === "pending" ? (
                            <TableCell className="space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending ||
                                  !isPending
                                }
                                onClick={() => approveMutation.mutate(p.id)}
                              >
                                {t("common_approve", "Approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending ||
                                  !isPending
                                }
                                onClick={() => rejectMutation.mutate(p.id)}
                              >
                                {t("common_reject", "Reject")}
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin_invite_user", "Invite User")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("common_email", "Email")}</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("email_placeholder", "user@email.com")}
              />
            </div>
            <p className="text-xs text-slate-500">
              {t("admin_invite_help", "This sends a magic link email. The user will create their account when they log in.")}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviteLoading}
            >
              {t("common_cancel", "Cancel")}
            </Button>
            <Button
              className="bg-slate-900 hover:bg-slate-800"
              onClick={handleInvite}
              disabled={!inviteEmail || inviteLoading}
            >
              {inviteLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("admin_send_invite", "Send Invite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
