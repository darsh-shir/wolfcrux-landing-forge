import { useState, useEffect } from "react";
import { loadDefaultSalaries, saveDefaultSalary, TRAINEE_STIPEND_INR, type SalaryInfo } from "@/lib/salary";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { EX_EMPLOYEE_ROLE, CLOSED_PREFIX, isExEmployee, isClosedAccount, accountLabel } from "@/lib/employees";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, Key, Trash2, Edit, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  trader_number?: string | null;
  joining_date?: string | null;
  birthdate?: string | null;
  employee_role?: string;
  assigned_trader_id?: string | null;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

interface TradingAccount {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string | null;
}

interface UserManagementProps {
  users: Profile[];
  accounts: TradingAccount[];
  onRefresh: () => void;
}

const UserManagement = ({ users, accounts, onRefresh }: UserManagementProps) => {
  const { toast } = useToast();
  const EMPLOYEE_ID_PREFIX = "WGM";
  const [roles, setRoles] = useState<UserRole[]>([]);
  // Default monthly salaries (stored as this year's base salary in Salary Backup)
  const [salaries, setSalaries] = useState<Map<string, SalaryInfo>>(new Map());
  const loadSalaries = async () => {
    try {
      setSalaries(await loadDefaultSalaries(new Date().getFullYear()));
    } catch {
      /* column shows blank */
    }
  };
  useEffect(() => {
    void loadSalaries();
  }, []);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newEmployeeRole, setNewEmployeeRole] = useState<"trainee" | "trader">("trainee");
  const [newTraderNumber, setNewTraderNumber] = useState("");
  const [newJoiningDate, setNewJoiningDate] = useState("");
  const [newBirthdate, setNewBirthdate] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editTraderNumber, setEditTraderNumber] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editEmployeeRole, setEditEmployeeRole] = useState<"trainee" | "trader">("trainee");

  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const activeUsers = users.filter((u) => !isExEmployee(u));
  const exUsers = users.filter(isExEmployee);
  const openAccounts = accounts.filter((a) => !isClosedAccount(a));
  const closedAccounts = accounts.filter(isClosedAccount);
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    fetchRoles();
  }, [users]);

  const formatEmployeeId = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? `${EMPLOYEE_ID_PREFIX}${digits}` : "";
  };

  const extractEmployeeIdDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

  const fetchRoles = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    if (data) setRoles(data as UserRole[]);
  };

  const getUserRole = (userId: string) => {
    const r = roles.find((role) => role.user_id === userId);
    return r?.role || "user";
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsCreating(true);

    try {
      const response = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "create_user",
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          role: newRole,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      if (response.data?.userId) {
        const newUserId = response.data.userId;
        // The handle_new_user trigger inserts the profile asynchronously.
        // Poll briefly until the row exists, then update it.
        let profileReady = false;
        for (let i = 0; i < 10; i++) {
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", newUserId)
            .maybeSingle();
          if (existing) { profileReady = true; break; }
          await new Promise((r) => setTimeout(r, 300));
        }

        const profilePayload: TablesUpdate<"profiles"> = {
          trader_number: formatEmployeeId(newTraderNumber) || null,
          joining_date: newJoiningDate || null,
          birthdate: newBirthdate || null,
          employee_role: newEmployeeRole,
          assigned_trader_id: null,
        };

        if (profileReady) {
          const { error: updErr } = await supabase
            .from("profiles")
            .update(profilePayload)
            .eq("user_id", newUserId);
          if (updErr) throw new Error(`Profile details not saved: ${updErr.message}`);
        } else {
          // Fallback: insert if trigger somehow didn't fire
          const { error: insErr } = await supabase
            .from("profiles")
            .insert({
              user_id: newUserId,
              full_name: newFullName,
              email: newEmail,
              ...profilePayload,
            });
          if (insErr) throw new Error(`Profile details not saved: ${insErr.message}`);
        }
      }

      toast({ title: "Success", description: "User created successfully" });
      setShowCreateDialog(false);
      setNewEmail(""); setNewPassword(""); setNewFullName(""); setNewRole("user");
      setNewEmployeeRole("trainee"); setNewTraderNumber(""); setNewJoiningDate("");
      setNewBirthdate("");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsCreating(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase.from("profiles").update({
        full_name: editFullName,
        trader_number: formatEmployeeId(editTraderNumber) || null,
        joining_date: editJoiningDate || null,
        birthdate: editBirthdate || null,
        employee_role: editEmployeeRole,
        assigned_trader_id: null,
      }).eq("user_id", editingUser.user_id);
      if (error) throw error;
      toast({ title: "Success", description: "User updated successfully" });
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };


  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPasswordValue) return;

    if (newPasswordValue.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setIsResettingPassword(true);

    try {
      const response = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "reset_password",
          userId: resetPasswordUser.user_id,
          password: newPasswordValue,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "Password reset successfully" });
      setResetPasswordUser(null);
      setNewPasswordValue("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsResettingPassword(false);
  };

  /** Keep every record, hide from lists, and block sign-in. */
  const moveToExEmployees = async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("profiles").update({ employee_role: EX_EMPLOYEE_ROLE }).eq("user_id", deleteUser.user_id);
      if (error) throw new Error(error.message);
      // Block sign-in on the server (Restore unblocks it); their password is kept.
      const response = await supabase.functions.invoke("admin-operations", {
        body: { action: "set_access", userId: deleteUser.user_id, blocked: true },
      });
      const blockError = response.error?.message || response.data?.error;
      toast({
        title: "Moved to ex-employees",
        description: blockError
          ? `${deleteUser.full_name}'s records are kept, but sign-in couldn't be blocked (${blockError}). Try again from Ex-employees → Restore, then remove again.`
          : `${deleteUser.full_name}'s records are kept and they can no longer sign in.`,
        variant: blockError ? "destructive" : undefined,
      });
      setDeleteUser(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  const restoreEmployee = async (user: Profile) => {
    const { error } = await supabase.from("profiles").update({ employee_role: "trader" }).eq("user_id", user.user_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const response = await supabase.functions.invoke("admin-operations", {
      body: { action: "set_access", userId: user.user_id, blocked: false },
    });
    const unblockError = response.error?.message || response.data?.error;
    toast({
      title: "Restored",
      description: unblockError
        ? `${user.full_name} is back in the list, but sign-in couldn't be unblocked (${unblockError}).`
        : `${user.full_name} is back in the employee list and can sign in with their old password.`,
      variant: unblockError ? "destructive" : undefined,
    });
    onRefresh();
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);

    try {
      // Deleting a user permanently deletes every trade they made (and changes
      // company and partner history), so it is blocked while trades exist.
      const [asPrimary, asPartner] = await Promise.all([
        supabase.from("trading_data").select("id", { count: "exact", head: true }).eq("user_id", deleteUser.user_id),
        supabase.from("trading_data").select("id", { count: "exact", head: true }).eq("trader2_id", deleteUser.user_id),
      ]);
      if (asPrimary.error || asPartner.error) throw new Error((asPrimary.error || asPartner.error)!.message);
      const tradeCount = (asPrimary.count ?? 0) + (asPartner.count ?? 0);
      if (tradeCount > 0) {
        toast({
          title: "Can't delete this user",
          description: `${deleteUser.full_name} has ${tradeCount} trade record(s), so they can't be deleted permanently. Use "Move to ex-employees" instead.`,
          variant: "destructive",
        });
        setDeleteUser(null);
        setIsDeleting(false);
        return;
      }

      const response = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "delete_user",
          userId: deleteUser.user_id,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "User deleted successfully" });
      setDeleteUser(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsDeleting(false);
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditTraderNumber(extractEmployeeIdDigits(user.trader_number));
    setEditJoiningDate(user.joining_date || "");
    setEditBirthdate(user.birthdate || "");
    setEditEmployeeRole((user.employee_role as "trainee" | "trader") || "trainee");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold font-['Space_Grotesk']">User Management</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="px-3 text-sm text-muted-foreground border-r border-border">{EMPLOYEE_ID_PREFIX}</span>
                  <Input
                    value={newTraderNumber}
                    onChange={(e) => setNewTraderNumber(extractEmployeeIdDigits(e.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Joining Date</Label>
                  <Input type="date" value={newJoiningDate} onChange={(e) => setNewJoiningDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Birthdate</Label>
                  <Input type="date" value={newBirthdate} onChange={(e) => setNewBirthdate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Employee Role</Label>
                  <Select value={newEmployeeRole} onValueChange={(v) => setNewEmployeeRole(v as "trainee" | "trader")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainee">Trainee</SelectItem>
                      <SelectItem value="trader">Trader</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Birthday</TableHead>
                  <TableHead>Employee Role</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Salary (₹/month)</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsers.sort((a, b) => {
                  const numA = parseInt((a.trader_number || "999999").replace(/\D/g, "")) || 999999;
                  const numB = parseInt((b.trader_number || "999999").replace(/\D/g, "")) || 999999;
                  return numA - numB;
                }).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.trader_number || "—"}</TableCell>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.birthdate ? new Date(user.birthdate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.employee_role === "trader" ? "default" : "secondary"}>
                        {user.employee_role === "trader" ? "Trader" : "Trainee"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.joining_date || "—"}</TableCell>
                    <TableCell>
                      <SalaryCell
                        userId={user.user_id}
                        current={salaries.get(user.user_id)?.salary ?? null}
                        isTrainee={user.employee_role !== "trader"}
                        onSaved={() => void loadSalaries()}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={getUserRole(user.user_id) === "admin" ? "default" : "outline"}>
                        {getUserRole(user.user_id) === "admin" ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setResetPasswordUser(user)} title="Reset Password">
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteUser(user)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trading Accounts</CardTitle>
          <AccountDialog accounts={accounts} onRefresh={onRefresh} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Account Number</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.account_number || "—"}</TableCell>
                  <TableCell>{account.account_name}</TableCell>
                  <TableCell>
                    <AccountActions account={account} onRefresh={onRefresh} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ex-employees and closed accounts: kept for records, rarely needed */}
      {(exUsers.length > 0 || closedAccounts.length > 0) && (
        <div className="space-y-2 text-sm">
          {exUsers.length > 0 && (
            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-muted-foreground">Ex-employees ({exUsers.length})</summary>
              <ul className="mt-2 divide-y">
                {exUsers.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground w-16">{u.trader_number || "—"}</span>
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-muted-foreground">{u.email}</span>
                    {u.joining_date && <span className="text-xs text-muted-foreground">joined {u.joining_date}</span>}
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => void restoreEmployee(u)}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {closedAccounts.length > 0 && (
            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-muted-foreground">Closed accounts ({closedAccounts.length})</summary>
              <ul className="mt-2 divide-y">
                {closedAccounts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground w-24">{a.account_number || "—"}</span>
                    <span className="font-medium">{accountLabel(a)}</span>
                    <ReopenAccountButton account={a} onRefresh={onRefresh} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="px-3 text-sm text-muted-foreground border-r border-border">{EMPLOYEE_ID_PREFIX}</span>
                  <Input
                    value={editTraderNumber}
                    onChange={(e) => setEditTraderNumber(extractEmployeeIdDigits(e.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="001"
                  />
                </div>
              </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input type="date" value={editJoiningDate} onChange={(e) => setEditJoiningDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Birthdate</Label>
                <Input type="date" value={editBirthdate} onChange={(e) => setEditBirthdate(e.target.value)} />
              </div>
            </div>
              <div className="space-y-2">
                <Label>Employee Role</Label>
                <Select value={editEmployeeRole} onValueChange={(v) => setEditEmployeeRole(v as "trainee" | "trader")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainee">Trainee</SelectItem>
                    <SelectItem value="trader">Trader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            <SaveButton type="submit" className="w-full" />
          </form>
        </DialogContent>
      </Dialog>


      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetPasswordUser?.full_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPasswordValue} onChange={(e) => setNewPasswordValue(e.target.value)} placeholder="••••••••" minLength={6} />
              <p className="text-sm text-muted-foreground">Minimum 6 characters</p>
            </div>
            <Button type="submit" className="w-full" disabled={isResettingPassword}>
              {isResettingPassword ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>) : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteUser?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>Move to ex-employees</strong> keeps all their trades, payouts and documents, hides them from the employee
                  list and blocks their sign-in. You can restore them later from "Ex-employees" at the bottom of this page.
                </p>
                <p>
                  <strong>Delete permanently</strong> erases the account. It's only possible for someone with no trade records.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="outline" className="text-destructive" onClick={() => void handleDeleteUser()} disabled={isDeleting}>
              Delete permanently
            </Button>
            <Button onClick={() => void moveToExEmployees()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move to ex-employees"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Sub-component for adding accounts
const AccountDialog = ({ accounts, onRefresh }: { accounts: TradingAccount[]; onRefresh: () => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName) {
      toast({ title: "Error", description: "Account name is required", variant: "destructive" });
      return;
    }

    setIsCreating(true);

    const { error } = await supabase.from("trading_accounts").insert({
      account_name: accountName,
      account_number: accountNumber || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Account created" });
      setOpen(false);
      setAccountName("");
      setAccountNumber("");
      onRefresh();
    }

    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Trading Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g., Account A" />
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g., 12345678" />
          </div>
          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** Inline editor for an employee's default monthly salary (₹). */
const SalaryCell = ({ userId, current, isTrainee, onSaved }: { userId: string; current: number | null; isTrainee: boolean; onSaved: () => void }) => {
  const { toast } = useToast();
  const [value, setValue] = useState<string>(current != null ? String(current) : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(current != null ? String(current) : ""), [current]);
  const changed = value !== (current != null ? String(current) : "");
  const save = async () => {
    const amount = Number(value);
    if (!changed || !(amount >= 0) || value.trim() === "") return;
    setSaving(true);
    try {
      await saveDefaultSalary(userId, new Date().getFullYear(), amount);
      toast({ title: "Salary saved", description: `₹${amount.toLocaleString("en-IN")} per month from now on` });
      onSaved();
    } catch (e) {
      toast({ title: "Couldn't save salary", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min="0"
        className="h-8 w-28 text-right"
        value={value}
        placeholder={isTrainee ? String(TRAINEE_STIPEND_INR) : "0"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void save()}
        aria-label="Default monthly salary"
      />
      {changed && (
        <SaveButton onClick={() => void save()} saving={saving} />
      )}
    </div>
  );
};

// Sub-component for account actions
const AccountActions = ({ account, onRefresh }: { account: TradingAccount; onRefresh: () => void }) => {
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(account.account_name);
  const [editNumber, setEditNumber] = useState(account.account_number || "");

  const handleDelete = async () => {
    // Deleting an account permanently deletes every trade recorded on it.
    const { count, error: countError } = await supabase
      .from("trading_data").select("id", { count: "exact", head: true }).eq("account_id", account.id);
    if (countError) {
      toast({ title: "Error", description: countError.message, variant: "destructive" });
      setShowDelete(false);
      return;
    }
    if ((count ?? 0) > 0) {
      toast({
        title: "Can't delete this account",
        description: `${count} trade record(s) use this account, so it can't be deleted. Choose "Account closed" instead.`,
        variant: "destructive",
      });
      setShowDelete(false);
      return;
    }
    const { error } = await supabase.from("trading_accounts").delete().eq("id", account.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Account removed" });
      onRefresh();
    }
    setShowDelete(false);
  };

  const closeAccount = async () => {
    const { error } = await supabase
      .from("trading_accounts")
      .update({ account_name: CLOSED_PREFIX + accountLabel(account) })
      .eq("id", account.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account closed", description: `${accountLabel(account)} moved to Closed accounts. Its trades are kept.` });
      onRefresh();
    }
    setShowDelete(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("trading_accounts")
      .update({ account_name: editName, account_number: editNumber || null })
      .eq("id", account.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Account updated" });
      setShowEdit(false);
      onRefresh();
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowDelete(true)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} />
            </div>
            <SaveButton type="submit" className="w-full" />
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {account.account_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>Account closed</strong> keeps all its trades and moves it to "Closed accounts" at the bottom of this page.
                  It won't be offered for new entries.
                </p>
                <p>
                  <strong>Delete</strong> erases it permanently. It's only possible for an account with no trades.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" className="text-destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
            <Button onClick={() => void closeAccount()}>Account closed</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** Puts a closed account back in the active list. */
const ReopenAccountButton = ({ account, onRefresh }: { account: TradingAccount; onRefresh: () => void }) => {
  const { toast } = useToast();
  const reopen = async () => {
    const { error } = await supabase.from("trading_accounts").update({ account_name: accountLabel(account) }).eq("id", account.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Account reopened", description: accountLabel(account) });
    onRefresh();
  };
  return (
    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => void reopen()}>
      Reopen
    </Button>
  );
};

export default UserManagement;
