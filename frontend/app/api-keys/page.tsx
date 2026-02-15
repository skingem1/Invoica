"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiKeys, createNewApiKey, deleteApiKey, ApiKey } from "@/lib/api-client";
import { Trash2, Plus, Copy, Check } from "lucide-react";

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load API keys. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a name for the API key.",
      });
      return;
    }

    try {
      setIsCreating(true);
      const result = await createNewApiKey(newKeyName);

      toast({
        title: "API Key Created",
        description: "Make sure to copy your API key now. You won't be able to see it again.",
      });

      setApiKeys((prev) => [result.apiKey, ...prev]);
      setIsDialogOpen(false);
      setNewKeyName("");

      // Copy the secret to clipboard
      await navigator.clipboard.writeText(result.secret);
      setCopiedKeyId(result.apiKey.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create API key. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteApiKey(keyId);
      setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
      toast({
        title: "API Key Deleted",
        description: "The API key has been permanently deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete API key. Please try again.",
      });
    }
  };

  const handleCopyKey = async (keyId: string, keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
      toast({
        title: "Copied",
        description: "API key copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard.",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isKeyExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage your API keys for accessing the Countable API.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Give your API key a descriptive name to help you identify it later.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="e.g., Production App, Development"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                disabled={isCreating}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateKey} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            API keys provide full access to your account. Keep them secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-muted-foreground">Loading API keys...</div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-muted-foreground mb-4">
                You haven't created any API keys yet.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                          {apiKey.prefix}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyKey(apiKey.id, apiKey.prefix)}
                        >
                          {copiedKeyId === apiKey.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(apiKey.createdAt)}</TableCell>
                    <TableCell>
                      {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never"}
                    </TableCell>
                    <TableCell>
                      {isKeyExpired(apiKey.expiresAt) ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteKey(apiKey.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}