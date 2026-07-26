import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Schoonmaak Twente | McCoy Cleaning" },
      {
        name: "description",
        content:
          "Neem contact op met McCoy Cleaning voor algemene vragen of aanvragen voor professionele schoonmaak in Twente. Persoonlijk antwoord binnen één werkdag.",
      },
      { property: "og:title", content: "Contact — McCoy Cleaning Twente" },
      {
        property: "og:description",
        content: "Neem contact op met McCoy Cleaning in Oldenzaal.",
      },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
        {/* hero */}
        <section className="relative px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
            >
              {t.contact.kicker}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.7 }}
              className="font-display mt-4 max-w-3xl text-5xl text-white md:text-7xl"
            >
              {t.contact.title}
            </motion.h1>
            <p className="mt-5 max-w-2xl font-bold text-white/65">{t.contact.sub}</p>
          </div>
        </section>

        {/* contact strip */}
        <section className="mx-auto mt-16 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { icon: Mail, label: "E-mail", value: "info@mccoy.nl", href: "mailto:info@mccoy.nl" },
            {
              icon: Phone,
              label: t.contact.phone,
              value: "0541 534 982",
              href: "tel:+31541534982",
            },
            { icon: MapPin, label: t.contact.address, value: t.contact.addressValue },
            { icon: Clock, label: t.contact.hours, value: t.contact.hoursValue },
          ].map((c, i) => {
            const Icon = c.icon;
            const Inner = (
              <>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    {c.label}
                  </div>
                  <div className="mt-1 whitespace-pre-line text-sm text-white">{c.value}</div>
                </div>
              </>
            );
            return (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                {c.href ? (
                  <a
                    href={c.href}
                    className="flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-card/60 p-5 transition hover:border-primary/40"
                  >
                    {Inner}
                  </a>
                ) : (
                  <div className="flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-card/60 p-5">
                    {Inner}
                  </div>
                )}
              </motion.div>
            );
          })}
        </section>

        {/* single simple form */}
        <section className="mx-auto max-w-3xl px-4 pb-28 pt-16 sm:px-6 lg:px-8">
          <SimpleForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SimpleForm() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-[2rem] border border-white/10 bg-card/60 p-7 md:p-10">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="font-display text-2xl text-white">{t.contact.success}</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label={t.contact.name} name="name" required />
          <Field label={t.contact.company} name="company" />
          <Field label={t.contact.phone} name="phone" type="tel" />
          <Field label={t.contact.email} name="email" type="email" required />
          <TextArea label={t.contact.message} name="message" />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] sm:col-span-2"
          >
            {t.contact.submit}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        maxLength={255}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <textarea
        name={name}
        rows={5}
        maxLength={1500}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}
