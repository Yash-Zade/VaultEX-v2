import TradingPlatform from "@/components/TradingPlatform";
import DefaultLayout from "@/layouts/default";

export default function TradePage() {
  return (
    <DefaultLayout>
      <section>
          <TradingPlatform />
      </section>
    </DefaultLayout>
  );
}
