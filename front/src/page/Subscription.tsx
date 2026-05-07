import MainHeader from "../components/MainHeader/MainHeader";
import { PlansPanel } from "../components/SubscriptionComponents/PlansPanel";

export function Subscription() {
  return (
    <>
      <MainHeader />
      <div className="bg-lumenjuris-background min-h-[calc(100vh-64px)] w-screen py-8">
        <PlansPanel />
      </div>
    </>
  );
}
