"use client";

import Link from "next/link";
import { useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Card, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Route = { id: string; routeNumber: string; name: string | null; stops: string[] };

/** Choose a route and the stop on it, or no school transport. */
export function TransportAssign({
  action,
  routes,
  routeId,
  stop,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  routes: Route[];
  routeId: string | null;
  stop: string | null;
}) {
  const [chosen, setChosen] = useState(routeId ?? "");
  const route = routes.find((r) => r.id === chosen);
  return (
    <Card title="Change transport" className="self-start">
      {routes.length === 0 ? (
        <p className="text-sm text-muted">
          No routes yet. Add them under <Link href="/admin/transport" className="font-medium text-accent-text hover:underline">Transport</Link>.
        </p>
      ) : (
        <ActionForm action={action} keepValues className="space-y-4">
          {(state) => (
            <>
              <Field label="Route" name="routeId" errors={state.fieldErrors}>
                <select name="routeId" value={chosen} onChange={(e) => setChosen(e.target.value)} className={selectClass}>
                  <option value="">No school transport</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeNumber}
                      {r.name ? ` · ${r.name}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {route && route.stops.length > 0 && (
                <Field label="Stop" name="stop" errors={state.fieldErrors} required>
                  <select key={route.id} name="stop" required defaultValue={route.id === routeId ? (stop ?? "") : ""} className={selectClass}>
                    <option value="" disabled>
                      Choose a stop
                    </option>
                    {route.stops.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <SubmitButton icon={<Save className="h-4 w-4" />} variant="secondary">
                Save
              </SubmitButton>
            </>
          )}
        </ActionForm>
      )}
    </Card>
  );
}
