import { db } from "@/lib/db";

export const metadata = { title: "FAQ · DUT-AMP" };

export default async function FaqPage() {
  const faqs = await db.faq.findMany({ orderBy: { sort: "asc" } });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[28px] bg-[#112a22] p-8 text-white">
        <span className="inline-block rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
          Help Centre &amp; Residence Policies
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="mt-1 text-sm text-neutral-300">
          Guidance for public holiday travellers, institutional coordinators, and residence guests.
        </p>
      </div>
      <dl className="space-y-4">
        {faqs.map((f) => (
          <div key={f.id} className="rounded-[24px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <dt className="font-bold text-lg text-[#112a22]">{f.question}</dt>
            <dd className="mt-2 text-sm text-neutral-600 leading-relaxed">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
