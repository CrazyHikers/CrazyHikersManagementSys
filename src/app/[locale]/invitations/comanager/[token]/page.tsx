"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InvitationData = {
  activityTitle: string;
  activityDate: string;
  invitedAs: string;
  invitedByName: string;
  yourName: string;
};

type ErrorState = {
  error: string;
  message: string;
  status?: string;
};

export default function ComanagerInvitationPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invitations/comanager/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json);
        } else {
          setData(json);
        }
      })
      .catch(() => setError({ error: "network", message: "Failed to load invitation" }))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleResponse(accepted: boolean) {
    setResponding(true);
    try {
      const res = await fetch(`/api/invitations/comanager/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      const json = await res.json();
      if (res.ok) {
        setResponded(json.status);
      } else {
        setError({ error: "failed", message: json.error || "Failed to respond" });
      }
    } catch {
      setError({ error: "network", message: "Network error" });
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>
            {responded
              ? responded === "confirmed"
                ? "Invitation Accepted!"
                : "Invitation Declined"
              : error
                ? "Invitation"
                : "Co-manager Invitation"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responded && (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">
                {responded === "confirmed"
                  ? "You are now a co-manager for this activity."
                  : "You have declined the invitation."}
              </p>
            </div>
          )}

          {error && !responded && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">{error.message}</p>
              {error.status && (
                <p className="text-sm text-muted-foreground mt-2">
                  Status: {error.status}
                </p>
              )}
            </div>
          )}

          {data && !responded && !error && (
            <div className="space-y-4">
              <CardDescription className="text-center">
                <strong>{data.invitedByName}</strong> has invited you to co-manage an activity.
              </CardDescription>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Activity: </span>
                  <strong>{data.activityTitle}</strong>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Date: </span>
                  {new Date(data.activityDate).toLocaleDateString()}
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Your role: </span>
                  Co-manager
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleResponse(true)}
                  disabled={responding}
                >
                  {responding ? "..." : "Accept"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleResponse(false)}
                  disabled={responding}
                >
                  {responding ? "..." : "Decline"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
