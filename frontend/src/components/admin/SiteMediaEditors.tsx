// Website Studio: hero video + announcement bar editors.
// The YouTube URL is validated server-side (id extracted) — arbitrary iframe HTML is rejected.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2, TriangleAlert } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { Announcement, HeroVideo } from "@/lib/crmTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6" data-testid={testId}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HeroVideoEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-hero-video"], queryFn: () => apiGet<HeroVideo>("/admin/hero-video") });
  const [url, setUrl] = useState("");
  const [poster, setPoster] = useState("");
  const [alt, setAlt] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setUrl(data.video_url ?? "");
    setPoster(data.poster_url ?? "");
    setAlt(data.poster_alt ?? "");
    setEnabled(data.enabled ?? true);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPut<HeroVideo>("/admin/hero-video", {
        video_url: url,
        poster_url: poster || null,
        poster_alt: alt || null,
        enabled,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-hero-video"] });
      qc.invalidateQueries({ queryKey: ["hero-video"] });
      toast.success("Hero video saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Panel title="Hero video (below the navbar)" testId="admin-hero-video">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="hv-url">Hero Video URL (Direct MP4 or Video URL)</Label>
          <Input
            id="hv-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://videotourl.com/videos/…mp4 or direct video URL"
            data-testid="admin-hero-video-url"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Direct MP4 video URLs (e.g. videotourl.com) and streaming video files are validated against the host for streaming playback. YouTube URLs are also supported.
          </p>
          {data?.video_url && (
            <p className="mt-1 text-xs font-medium text-brand-deep" data-testid="admin-hero-video-id">
              Active Video: {data.video_type === "mp4" ? "Native MP4 Video" : "YouTube"} ({data.video_id})
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="hv-poster">Poster image URL (optional)</Label>
          <Input
            id="hv-poster"
            value={poster}
            onChange={(e) => setPoster(e.target.value)}
            placeholder="/brand/hero-poster.jpg or https://…"
            data-testid="admin-hero-video-poster"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown while the video loads, when autoplay is blocked, and first for reduced-motion visitors.
            {data?.poster_pending && " Currently pending — a labelled placeholder is shown instead."}
          </p>
        </div>
        <div>
          <Label htmlFor="hv-alt">Poster alt text</Label>
          <Input id="hv-alt" value={alt} onChange={(e) => setAlt(e.target.value)} data-testid="admin-hero-video-alt" />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} data-testid="admin-hero-video-enabled" />
          Show the video hero on the homepage
        </label>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="admin-hero-video-save">
            {save.isPending ? "Saving…" : "Save hero video"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Autoplay is attempted muted and inline with a single-video loop, but browsers may block it — a visible
          play control is always rendered, so autoplay is never presented as guaranteed.
        </p>
      </div>
    </Panel>
  );
}

export function AnnouncementEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => apiGet<Announcement[]>("/admin/announcements") });
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const rows = data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const create = useMutation({
    mutationFn: () => apiPost("/admin/announcements", { label, href: href || null, enabled: false }),
    onSuccess: () => {
      setLabel("");
      setHref("");
      invalidate();
      toast.success("Message added as disabled — enable it to publish");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const patch = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => apiPatch(`/admin/announcements/${p.id}`, p.body),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/announcements/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Message removed");
    },
  });

  const move = (i: number, dir: -1 | 1) => {
    const a = rows[i];
    const b = rows[i + dir];
    if (!a || !b) return;
    patch.mutate({ id: a.id, body: { sort: b.sort } });
    patch.mutate({ id: b.id, body: { sort: a.sort } });
  };

  return (
    <Panel title="Announcement bar (above the navbar)" testId="admin-announcements">
      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {rows.map((a, i) => (
          <div key={a.id} className="rounded-xl border border-border p-4" data-testid={`admin-announcement-${a.id}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                defaultValue={a.label}
                onBlur={(e) => e.target.value !== a.label && patch.mutate({ id: a.id, body: { label: e.target.value } })}
                className="max-w-48"
                data-testid={`admin-announcement-label-${a.id}`}
              />
              <Input
                defaultValue={a.href ?? ""}
                placeholder="/collections (optional link)"
                onBlur={(e) => (e.target.value || null) !== a.href && patch.mutate({ id: a.id, body: { href: e.target.value || null } })}
                className="max-w-64"
                data-testid={`admin-announcement-href-${a.id}`}
              />
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={a.enabled}
                  onCheckedChange={(v) => patch.mutate({ id: a.id, body: { enabled: v === true } })}
                  data-testid={`admin-announcement-enabled-${a.id}`}
                />
                {a.enabled ? "Published" : "Hidden"}
              </label>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" data-testid={`admin-announcement-up-${a.id}`}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" data-testid={`admin-announcement-down-${a.id}`}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)} aria-label="Remove" data-testid={`admin-announcement-remove-${a.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            {a.claim_key && a.claim_status !== "published" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-brand-amber" data-testid={`admin-announcement-claim-warning-${a.id}`}>
                <TriangleAlert className="h-3.5 w-3.5" />
                Linked claim <strong>{a.claim_key}</strong> is {a.claim_status}. Publishing this message states a claim
                you have not yet approved with evidence.
              </p>
            )}
            {a.claim_key && a.claim_status === "published" && (
              <Badge variant="secondary" className="mt-2">claim {a.claim_key} approved</Badge>
            )}
          </div>
        ))}

        <div className="mt-2 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="an-label">New message</Label>
            <Input id="an-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Free Shipping" data-testid="admin-announcement-new-label" />
          </div>
          <div>
            <Label htmlFor="an-href">Link (optional)</Label>
            <Input id="an-href" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/collections" data-testid="admin-announcement-new-href" />
          </div>
          <Button onClick={() => create.mutate()} disabled={!label.trim() || create.isPending} data-testid="admin-announcement-add">
            Add message
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          New messages start hidden. Enabling a message is your approval to publish it — only enable claims that apply
          to the products and policies currently on sale.
        </p>
      </div>
    </Panel>
  );
}
