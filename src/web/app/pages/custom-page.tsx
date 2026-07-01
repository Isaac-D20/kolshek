// Custom page view -- renders a user-defined dashboard page by its ID
import { useParams } from "react-router";
import { useNavigate } from "react-router";
import { FileQuestion, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCustomPage, useDeletePage } from "@/hooks/use-custom-pages";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomPageRenderer } from "@/components/custom-page/custom-page-renderer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/use-sync";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function CustomPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { data: page, isLoading, isError, error } = useCustomPage(pageId ?? "");
  const deletePage = useDeletePage();
  const { start, isRunning } = useSync();
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useDocumentTitle(page?.title ?? "Custom Page");

  const handleSync = () => {
    // If the page definition mentions specific providers or accounts, we could be smart.
    // For now, we'll just open the sync panel.
    start();
  };

  const handleEdit = () => {
    if (page) {
      navigate("/pages/new", { state: { editingPage: page } });
    }
  };

  const handleDelete = async () => {
    if (!page || !window.confirm(`Are you sure you want to delete the page "${page.title}"?`)) return;
    setIsDeleting(true);
    try {
      await deletePage.mutateAsync(page.id);
      window.location.href = "/";
    } catch (err) {
      alert("Failed to delete page");
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Error" />
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load page:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Not found
  if (!page) {
    return (
      <div className="space-y-6">
        <PageHeader title="Page Not Found" />
        <EmptyState
          icon={<FileQuestion />}
          title="Page not found"
          description="The custom page you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={page.title}
        description={page.description ?? undefined}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isRunning}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isRunning && "animate-spin")} />
            Sync
          </Button>
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </PageHeader>
      <CustomPageRenderer pageId={page.id} definition={page.definition} />
    </div>
  );
}
