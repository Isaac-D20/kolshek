// Left sidebar listing all categories with counts, create, rename, delete
import { useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { CategorySummary, ClassificationMap } from "@/types/api";
import {
  useCreateCategory,
  useRenameCategory,
  useDeleteCategory,
} from "@/hooks/use-categories";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ClassificationBadge } from "./classification-panel";

interface CategorySidebarProps {
  categories: CategorySummary[];
  activeCategory: string | null;
  onSelect: (cat: string) => void;
  classificationMap?: ClassificationMap;
}

export function CategorySidebar({
  categories,
  activeCategory,
  onSelect,
  classificationMap,
}: CategorySidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const createCategory = useCreateCategory();

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameMutation = useRenameCategory();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteMutation = useDeleteCategory();

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setNewName("");
          setCreateDialogOpen(false);
        },
      }
    );
  }

  const openRename = useCallback((name: string) => {
    setRenameValue(name);
    setRenameTarget(name);
  }, []);

  function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || !renameTarget || trimmed === renameTarget) return;
    renameMutation.mutate(
      { name: renameTarget, newName: trimmed },
      {
        onSuccess: () => {
          if (activeCategory === renameTarget) onSelect(trimmed);
          setRenameTarget(null);
          setRenameValue("");
        },
      }
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        if (activeCategory === deleteTarget) onSelect("Uncategorized");
        setDeleteTarget(null);
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.category;
            const isUncategorized = cat.category === "Uncategorized";

            return (
              <div
                key={cat.category}
                className={cn(
                  "group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <button
                  onClick={() => onSelect(cat.category)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                >
                  <span className="truncate">{cat.category}</span>
                  {classificationMap && classificationMap[cat.category] && (
                    <ClassificationBadge classification={classificationMap[cat.category]} />
                  )}
                </button>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "tabular-nums",
                      isUncategorized &&
                        cat.transactionCount > 0 &&
                        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    )}
                  >
                    {cat.transactionCount}
                  </Badge>
                  {!isUncategorized && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-background/80 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => openRename(cat.category)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(cat.category)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Enter a name for the new category.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription>
              Rename &ldquo;{renameTarget}&rdquo;. All transactions and rules will be updated.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || renameValue.trim() === renameTarget || renameMutation.isPending}
            >
              {renameMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deleteTarget}&rdquo;? All its transactions will be moved to Uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
