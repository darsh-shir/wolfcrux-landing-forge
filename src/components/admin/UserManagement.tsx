import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, Key, Trash2, Edit, Loader2, ArrowUpCircle } from "lucide-react";

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
  const [roles, setRoles] = useState<UserRole[]>([]);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newEmployeeRole, setNewEmployeeRole] = useState<"trainee" | "trader">("trainee");
  const [newTraderNumber, setNewTraderNumber] = useState("");
  const [newJoiningDate, setNewJoiningDate] = useState("");
  const [newBirthdate, setNewBirthdate] = useState("");
  const [newAssignedTrader, setNewAssignedTrader] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editTraderNumber, setEditTraderNumber] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editEmployeeRole, setEditEmployeeRole] = useState<"trainee" | "trader">("trainee");
  const [editAssignedTrader, setEditAssignedTrader] = useState("");

  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Promotion state
  const [promoteUser, setPromoteUser] = useState<Profile | null>(null);
  const [promoteAccountStartDate, setPromoteAccountStartDate] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, [users]);

  const fetchRoles = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    if (data) setRoles(data as UserRole[]);
  };

  const getUserRole = (userId: string) => {
    const r = roles.find((role) => role.user_id === userId);
    return r?.role || "user";
  };

  const traders = users.filter(u => u.employee_role === "trader");

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

      if (response.data?.user?.id) {
        await supabase.from("profiles").update({
          trader_number: newTraderNumber || null,
          joining_date: newJoiningDate || null,
          birthdate: newBirthdate || null,
          employee_role: newEmployeeRole,
          assigned_trader_id: newEmployeeRole === "trainee" && newAssignedTrader ? newAssignedTrader : null,
        }).eq("user_id", response.data.user.id);
      }

      toast({ title: "Success", description: "User created successfully" });
      setShowCreateDialog(false);
      setNewEmail(""); setNewPassword(""); setNewFullName(""); setNewRole("user");
      setNewEmployeeRole("trainee"); setNewTraderNumber(""); setNewJoiningDate("");
      setNewBirthdate(""); setNewAssignedTrader("");
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
      await supabase.from("profiles").update({
        full_name: editFullName,
        trader_number: editTraderNumber || null,
        joining_date: editJoiningDate || null,
        birthdate: editBirthdate || null,
        employee_role: editEmployeeRole,
        assigned_trader_id: editEmployeeRole === "trainee" && editAssignedTrader ? editAssignedTrader : null,
      }).eq("user_id", editingUser.user_id);
      toast({ title: "Success", description: "User updated successfully" });
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handlePromoteToTrader = async () => {
    if (!promoteUser || !promoteAccountStartDate) {
      toast({ title: "Error", description: "Please set the account start date", variant: "destructive" });
      return;
    }

    setIsPromoting(true);

    try {
      // Update profile to trader
      await supabase.from("profiles").update({
        employee_role: "trader",
        assigned_trader_id: null,
      }).eq("user_id", promoteUser.user_id);

      // Create milestone record
      const { data: existingMilestone } = await supabase.from("trader_milestones")
        .select("id").eq("user_id", promoteUser.user_id).maybeSingle();

      if (existingMilestone) {
        await supabase.from("trader_milestones").update({
          account_start_date: promoteAccountStartDate,
          current_level: 0,
          cumulative_net_profit: 0,
        }).eq("id", existingMilestone.id);
      } else {
        await supabase.from("trader_milestones").insert({
          user_id: promoteUser.user_id,
          account_start_date: promoteAccountStartDate,
          current_level: 0,
          cumulative_net_profit: 0,
        });
      }

      toast({ title: "Promoted!", description: `${promoteUser.full_name} is now a Trader starting at 20% STO` });
      setPromoteUser(null);
      setPromoteAccountStartDate("");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsPromoting(false);
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

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);

    try {
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
    setEditTraderNumber(user.trader_number || "");
    setEditJoiningDate(user.joining_date || "");
    setEditBirthdate(user.birthdate || "");
    setEditEmployeeRole((user.employee_role as "trainee" | "trader") || "trainee");
    setEditAssignedTrader(user.assigned_trader_id || "");
  };

  const getAssignedTraderName = (traderId: string | null | undefined) => {
    if (!traderId) return "—";
    const trader = users.find(u => u.user_id === traderId);
    return trader?.full_name || "—";
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
                <Label>Trader Number</Label>
                <Input value={newTraderNumber} onChange={(e) => setNewTraderNumber(e.target.value)} placeholder="T001" />
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
              {newEmployeeRole === "trainee" && (
                <div className="space-y-2">
                  <Label>Assigned Trader</Label>
                  <Select value={newAssignedTrader} onValueChange={setNewAssignedTrader}>
                    <SelectTrigger><SelectValue placeholder="Select trader" /></SelectTrigger>
                    <SelectContent>
                      {traders.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee Role</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...users].sort((a, b) => {
                  const numA = parseInt((a.trader_number || "999999").replace(/\D/g, "")) || 999999;
                  const numB = parseInt((b.trader_number || "999999").replace(/\D/g, "")) || 999999;
                  return numA - numB;
                }).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.trader_number || "—"}</TableCell>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.employee_role === "trader" ? "default" : "secondary"}>
                        {user.employee_role === "trader" ? "Trader" : "Trainee"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.joining_date || "—"}</TableCell>
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
                        {user.employee_role !== "trader" && (
                          <Button variant="ghost" size="sm" onClick={() => {
                            setPromoteUser(user);
                            setPromoteAccountStartDate(new Date().toISOString().split("T")[0]);
                          }} title="Promote to Trader">
                            <ArrowUpCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Number</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
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
        </CardContent>
      </Card>

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
              <Label>Trader Number</Label>
              <Input value={editTraderNumber} onChange={(e) => setEditTraderNumber(e.target.value)} placeholder="T001" />
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
            <div className="grid grid-cols-2 gap-3">
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
              {editEmployeeRole === "trainee" && (
                <div className="space-y-2">
                  <Label>Assigned Trader</Label>
                  <Select value={editAssignedTrader} onValueChange={setEditAssignedTrader}>
                    <SelectTrigger><SelectValue placeholder="Select trader" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {traders.filter(t => t.user_id !== editingUser?.user_id).map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promote to Trader Dialog */}
      <Dialog open={!!promoteUser} onOpenChange={() => setPromoteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote {promoteUser?.full_name} to Trader</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will set {promoteUser?.full_name} as a Trader with Level 0 (STO 20%, LTO 0%).
              Milestone tracking will begin from the account start date.
            </p>
            <div className="space-y-2">
              <Label>Account Start Date *</Label>
              <Input
                type="date"
                value={promoteAccountStartDate}
                onChange={(e) => setPromoteAccountStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">This is the date the trader receives their own account. Milestone time tracking starts here.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPromoteUser(null)}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handlePromoteToTrader} disabled={isPromoting}>
                {isPromoting ? <><Loader2 className="h-4 w-4 animate-spin" /> Promoting...</> : <><ArrowUpCircle className="h-4 w-4" /> Promote</>}
              </Button>
            </div>
          </div>
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
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {deleteUser?.full_name} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : "Delete"}
            </AlertDialogAction>
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

// Sub-component for account actions
const AccountActions = ({ account, onRefresh }: { account: TradingAccount; onRefresh: () => void }) => {
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(account.account_name);
  const [editNumber, setEditNumber] = useState(account.account_number || "");

  const handleDelete = async () => {
    const { error } = await supabase.from("trading_accounts").delete().eq("id", account.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Account removed" });
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
            <Button type="submit" className="w-full">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {account.account_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;
