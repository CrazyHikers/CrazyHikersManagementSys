"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CirclePlus, Minus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PollScope } from "@/lib/polls/types";

type EditorCopy = {
  title: string;
  description: string;
  scope: string;
  scopes: Record<PollScope, string>;
  deadline: string;
  options: string;
  option: string;
  addOption: string;
  removeOption: string;
  approveReject: string;
  approve: string;
  reject: string;
  allowOther: string;
  otherHint: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
};

type EditablePoll = {
  id: string;
  title: string;
  description: string;
  scope: PollScope;
  deadline: string;
  allowOther: boolean;
  options: Array<{ label: string }>;
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultDeadline(): string {
  return toLocalDateTime(new Date(Date.now() + 7 * 86_400_000).toISOString());
}

export function PollEditor({
  copy,
  initial,
}: {
  copy: EditorCopy;
  initial?: EditablePoll;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scope, setScope] = useState<PollScope>(initial?.scope ?? "member_plus");
  const [deadline, setDeadline] = useState(
    initial ? toLocalDateTime(initial.deadline) : defaultDeadline(),
  );
  const [allowOther, setAllowOther] = useState(initial?.allowOther ?? false);
  const [options, setOptions] = useState<string[]>(
    initial?.options.map((option) => option.label) ?? ["", ""],
  );
  const [saving, setSaving] = useState(false);

  function updateOption(index: number, value: string) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        initial ? `/api/polls/${initial.id}` : "/api/polls",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            scope,
            deadline: new Date(deadline).toISOString(),
            allowOther,
            options,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || copy.error);
      }
      const payload = await response.json();
      toast.success(copy.saved);
      const pollId = initial?.id ?? payload.poll.id;
      router.push(`/dashboard/polls/${pollId}/manage`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden border-emerald-950/10 shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-emerald-800 via-lime-600 to-amber-400" />
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="poll-title">{copy.title}</Label>
            <Input
              id="poll-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poll-description">{copy.description}</Label>
            <Textarea
              id="poll-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              rows={5}
              required
              className="bg-white"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poll-scope">{copy.scope}</Label>
              <select
                id="poll-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as PollScope)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="member_plus">{copy.scopes.member_plus}</option>
                <option value="intern_manager_plus">
                  {copy.scopes.intern_manager_plus}
                </option>
                <option value="qualified_manager_plus">
                  {copy.scopes.qualified_manager_plus}
                </option>
                <option value="admin">{copy.scopes.admin}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="poll-deadline">{copy.deadline}</Label>
              <Input
                id="poll-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                required
                className="bg-white"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Label>{copy.options}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions([copy.approve, copy.reject])}
                className="bg-white"
              >
                <Sparkles className="size-4 text-amber-600" />
                {copy.approveReject}
              </Button>
            </div>
            <div className="space-y-3">
              {options.map((option, index) => {
                const number = String(index + 1);
                return (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      aria-label={copy.option.replace("{number}", number)}
                      placeholder={copy.option.replace("{number}", number)}
                      maxLength={200}
                      required
                      className="bg-white"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={copy.removeOption.replace("{number}", number)}
                      disabled={options.length <= 2}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((_, optionIndex) => optionIndex !== index),
                        )
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={options.length >= 10}
              onClick={() => setOptions((current) => [...current, ""])}
              className="mt-3"
            >
              <CirclePlus className="size-4" />
              {copy.addOption}
            </Button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4">
            <input
              type="checkbox"
              aria-label={copy.allowOther}
              checked={allowOther}
              onChange={(event) => setAllowOther(event.target.checked)}
              className="mt-0.5 size-4 accent-emerald-700"
            />
            <span>
              <span className="block text-sm font-medium text-emerald-950">
                {copy.allowOther}
              </span>
              <span className="text-xs text-emerald-900/65">{copy.otherHint}</span>
            </span>
          </label>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto"
          >
            <Check className="size-4" />
            {saving ? copy.saving : copy.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
