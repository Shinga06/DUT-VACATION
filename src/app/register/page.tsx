import RegisterForm from "./RegisterForm";

export const metadata = { title: "Register · DUT-AMP" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-lg rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.05)] space-y-5">
      <div>
        <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-bold text-[#112a22]">
          Guest &amp; Coordinator Registration
        </span>
        <h1 className="mt-2 text-2xl font-bold text-[#112a22]">Create an Account</h1>
        <p className="mt-1 text-xs text-neutral-600">
          An account is required to submit a booking. Protected under POPIA privacy guidelines.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
