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
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, Key, Trash2, Edit } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
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
  
  // Create user form
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newAccountNumbers, setNewAccountNumbers] = useState<string[]>(["", ""]);
  const [isCreating, setIsCreating] = useState(false);

  // Edit user form
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editAccountNumbers, setEditAccountNumbers] = useState<string[]>([]);

  // Reset password
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");

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

  const getUserAccounts = (userId: string) => {
    return accounts.filter((a) => a.user_id === userId);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsCreating(true);

    try {
      // Create user via Supabase Auth Admin API (edge function needed)
      // For now, we'll use signUp and then update role
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: { full_name: newFullName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Update role if admin
      if (newRole === "admin") {
        await supabase.from("user_roles").update({ role: "admin" }).eq("user_id", authData.user.id);
      }

      // Create trading accounts with the provided account numbers
      const validAccounts = newAccountNumbers.filter((acc) => acc.trim());
      for (let i = 0; i < validAccounts.length; i++) {
        await supabase.from("trading_accounts").insert({
          user_id: authData.user.id,
          account_name: `Account ${i + 1}`,
          account_number: validAccounts[i],
        });
      }

      // Create leave balance for user (18 leaves per year)
      await supabase.from("leave_balances").insert({
        user_id: authData.user.id,
        total_leaves: 18,
        used_leaves: 0,
      });

      toast({ title: "Success", description: "User created successfully" });
      setShowCreateDialog(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("user");
      setNewAccountNumbers(["", ""]);
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
      // Update profile
      await supabase.from("profiles").update({ full_name: editFullName }).eq("user_id", editingUser.user_id);

      // Update/create accounts
      const existingAccounts = getUserAccounts(editingUser.user_id);
      
      for (let i = 0; i < editAccountNumbers.length; i++) {
        const accNum = editAccountNumbers[i];
        if (existingAccounts[i]) {
          await supabase.from("trading_accounts")
            .update({ account_number: accNum || null })
            .eq("id", existingAccounts[i].id);
        } else if (accNum.trim()) {
          await supabase.from("trading_accounts").insert({
            user_id: editingUser.user_id,
            account_name: `Account ${i + 1}`,
            account_number: accNum,
          });
        }
      }

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

    // Note: Admin password reset requires edge function with service role
    toast({ 
      title: "Note", 
      description: "Password reset requires server-side implementation. User can use 'Forgot Password' flow.",
      variant: "default" 
    });
    setResetPasswordUser(null);
    setNewPasswordValue("");
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    const userAccounts = getUserAccounts(user.user_id);
    setEditAccountNumbers([
      userAccounts[0]?.account_number || "",
      userAccounts[1]?.account_number || "",
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold font-['Space_Grotesk']">User Management</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Numbers</Label>
                <div className="space-y-2">
                  <Input
                    value={newAccountNumbers[0]}
                    onChange={(e) => setNewAccountNumbers([e.target.value, newAccountNumbers[1]])}
                    placeholder="Account 1 Number"
                  />
                  <Input
                    value={newAccountNumbers[1]}
                    onChange={(e) => setNewAccountNumbers([newAccountNumbers[0], e.target.value])}
                    placeholder="Account 2 Number"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getUserRole(user.user_id) === "admin" ? "default" : "secondary"}>
                      {getUserRole(user.user_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getUserAccounts(user.user_id).map((acc) => (
                      <span key={acc.id} className="text-sm text-muted-foreground block">
                        {acc.account_number || acc.account_name}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setResetPasswordUser(user)}>
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
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
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Numbers</Label>
              <div className="space-y-2">
                <Input
                  value={editAccountNumbers[0] || ""}
                  onChange={(e) => setEditAccountNumbers([e.target.value, editAccountNumbers[1] || ""])}
                  placeholder="Account 1 Number"
                />
                <Input
                  value={editAccountNumbers[1] || ""}
                  onChange={(e) => setEditAccountNumbers([editAccountNumbers[0] || "", e.target.value])}
                  placeholder="Account 2 Number"
                />
              </div>
            </div>
            <Button type="submit" className="w-full">Save Changes</Button>
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
              <Input
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full">Reset Password</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
