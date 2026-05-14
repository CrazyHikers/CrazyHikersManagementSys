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

// Sentinel values used by the template <Select> trigger to switch into
// custom-input or "clear" mode. Not real templates — handled inline.
const CUSTOM_SENTINEL = "__custom__";
const NONE_SENTINEL = "__none__";

function templateLabel(v: string): string {
  if (v === NONE_SENTINEL) return "(none)";
  if (v === CUSTOM_SENTINEL) return "Custom…";
  return v;
}

export function DevActivityControls({
  activityId,
  currentTemplate,
  knownTemplates,
  currentSlug,
}: {
  activityId: string;
  currentTemplate: string | null;
  knownTemplates: string[];
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
          knownTemplates={knownTemplates}
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
  knownTemplates,
}: {
  activityId: string;
  currentTemplate: string | null;
  knownTemplates: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // The select's controlled value. Treated separately from `current`
  // so the user can pick "Custom..." without immediately committing.
  const [picked, setPicked] = useState<string>(
    currentTemplate ?? NONE_SENTINEL
  );
  const [customDraft, setCustomDraft] = useState("");

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
    if (picked === NONE_SENTINEL) {
      commit(null);
      return;
    }
    if (picked === CUSTOM_SENTINEL) {
      const trimmed = customDraft.trim();
      if (!trimmed) {
        toast.error("Enter a custom template name");
        return;
      }
      commit(trimmed);
      return;
    }
    commit(picked);
  }

  const willClear = picked === NONE_SENTINEL;
  const willCustom = picked === CUSTOM_SENTINEL;
  const proposedValue = willClear
    ? null
    : willCustom
      ? customDraft.trim() || null
      : picked;
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
            {knownTemplates.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SENTINEL}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {willCustom && (
          <Input
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder="new_template_name"
            className="max-w-56"
            maxLength={64}
          />
        )}
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
        Allowed: letters, digits, <code>_</code> and <code>-</code>.
        Templates are populated from existing tagged activities; pick
        &quot;Custom…&quot; to introduce a new one.
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
