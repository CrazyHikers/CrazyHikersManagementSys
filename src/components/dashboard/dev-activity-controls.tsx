"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TEMPLATE_TAGS, type TemplateTag } from "@/lib/events/templates";

// Sentinel value for the "(none)" entry in the template <Select>.
// Real template tags come from the registry; this is just a UI marker
// so we can pass a real string through Radix's Select while still
// representing "no template assigned".
const NONE_SENTINEL = "__none__";

function templateLabel(v: string): string {
  if (v === NONE_SENTINEL) return "(none)";
  return v;
}

export function DevActivityControls({
  activityId,
  currentTemplate,
  currentSlug,
}: {
  activityId: string;
  currentTemplate: string | null;
  currentSlug: string | null;
}) {
  return (
    <Card className="mb-6 border-red-200">
      <CardHeader>
        <CardTitle className="text-lg text-red-700">Dev Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <TemplateSection
          activityId={activityId}
          currentTemplate={currentTemplate}
        />
        <SlugSection activityId={activityId} currentSlug={currentSlug} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- //
// Template sub-control                                              //
// ---------------------------------------------------------------- //
function TemplateSection({
  activityId,
  currentTemplate,
}: {
  activityId: string;
  currentTemplate: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // Templates come from the code registry — never from the DB. The
  // current row's tag is only shown as a *(legacy)* item if it isn't
  // in the registry, so a dev can switch off it.
  const isLegacy =
    currentTemplate !== null && !(TEMPLATE_TAGS as string[]).includes(currentTemplate);
  const [picked, setPicked] = useState<string>(
    currentTemplate ?? NONE_SENTINEL
  );

  async function commit(value: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success(
        value === null ? "Template cleared" : `Template set to ${value}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function handleApply() {
    commit(picked === NONE_SENTINEL ? null : picked);
  }

  const proposedValue = picked === NONE_SENTINEL ? null : picked;
  const isUnchanged =
    proposedValue === currentTemplate ||
    (proposedValue === null && currentTemplate === null);

  return (
    <div>
      <div className="text-sm font-medium mb-1">Template</div>
      <div className="text-xs text-muted-foreground mb-2">
        Current:{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">
          {currentTemplate ?? "(none)"}
        </code>
        {isLegacy && (
          <span className="ml-2 text-amber-700">
            (legacy — not in registry)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={picked}
          onValueChange={(v) => setPicked(v ?? NONE_SENTINEL)}
        >
          <SelectTrigger className="min-w-48">
            <span>{templateLabel(picked)}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SENTINEL}>(none)</SelectItem>
            {(TEMPLATE_TAGS as TemplateTag[]).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            {isLegacy && currentTemplate && (
              <SelectItem value={currentTemplate} disabled>
                {currentTemplate} (legacy)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="default"
          onClick={handleApply}
          disabled={saving || isUnchanged}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {saving ? "..." : "Apply"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Templates are defined in{" "}
        <code>src/lib/events/templates.ts</code>. To add a new one, register
        it there first.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- //
// Slug sub-control                                                  //
// ---------------------------------------------------------------- //
function SlugSection({
  activityId,
  currentSlug,
}: {
  activityId: string;
  currentSlug: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(currentSlug ?? "");

  async function commit(value: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success(value === null ? "Slug cleared" : `Slug set to ${value}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function handleApply() {
    const trimmed = draft.trim();
    commit(trimmed === "" ? null : trimmed);
  }

  const trimmedDraft = draft.trim();
  const isUnchanged =
    trimmedDraft === (currentSlug ?? "") ||
    (trimmedDraft === "" && currentSlug === null);
  const hasCurrent = currentSlug !== null;

  return (
    <div>
      <div className="text-sm font-medium mb-1">Slug</div>
      <div className="text-xs text-muted-foreground mb-2">
        Current:{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">
          {currentSlug ?? "(none)"}
        </code>
        {hasCurrent && (
          <span className="ml-2">
            → reachable at{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              /events/{currentSlug}
            </code>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 520-de"
          className="max-w-56"
          maxLength={64}
        />
        <Button
          size="sm"
          variant="default"
          onClick={handleApply}
          disabled={saving || isUnchanged}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {saving ? "..." : "Apply"}
        </Button>
        {hasCurrent && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => commit(null)}
            disabled={saving}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Allowed: letters, digits, <code>_</code> and <code>-</code>.
        Slugs must be unique across activities; the server rejects
        duplicates. Convention for region-split events:{" "}
        <code>520-de</code>, <code>520-fr</code>, etc.
      </p>
    </div>
  );
}
