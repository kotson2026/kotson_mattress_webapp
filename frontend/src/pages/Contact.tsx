import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = { name: "", email: "", phone: "", subject: "", message: "", issue_type: "general" };

export default function Contact() {
  const [form, setForm] = useState(EMPTY);

  const send = useMutation({
    mutationFn: () => apiPost("/crm/inquiries", form),
    onSuccess: () => {
      setForm(EMPTY);
      toast.success("Message sent — our team will reply by email");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send message"),
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Contact us</h1>
        <p className="mt-2 text-muted-foreground">
          Send us a message and it lands directly in our support inbox. Official phone and address are published once owner-validated.
        </p>

        <form
          className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={form.name} onChange={set("name")} required minLength={2} className="mt-1.5 min-h-11" data-testid="contact-name-input" />
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={set("email")} required className="mt-1.5 min-h-11" data-testid="contact-email-input" />
            </div>
          </div>
          <div>
            <Label htmlFor="c-phone">Phone (optional)</Label>
            <Input id="c-phone" value={form.phone} onChange={set("phone")} className="mt-1.5 min-h-11" data-testid="contact-phone-input" />
          </div>
          <div>
            <Label htmlFor="c-subject">Subject</Label>
            <Input id="c-subject" value={form.subject} onChange={set("subject")} required minLength={3} className="mt-1.5 min-h-11" data-testid="contact-subject-input" />
          </div>
          <div>
            <Label htmlFor="c-message">Message</Label>
            <Textarea id="c-message" value={form.message} onChange={set("message")} required minLength={5} rows={5} className="mt-1.5" data-testid="contact-message-input" />
          </div>
          <Button type="submit" size="lg" className="min-h-12" disabled={send.isPending} data-testid="contact-submit-button">
            {send.isPending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
