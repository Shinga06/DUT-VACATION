import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · DUT-AMP" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.05)] space-y-5">
      <div>
        <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-bold text-[#112a22]">
          Welcome Back
        </span>
        <h1 className="mt-2 text-2xl font-bold text-[#112a22]">Sign in to DUT-AMP</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Access your holiday bookings, institutional delegations, or staff portal.
        </p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
