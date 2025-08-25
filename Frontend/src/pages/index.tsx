import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { title, subtitle } from "@/components/primitives";
import { TrendingUp, Zap, Target, Shield, BarChart3, Wallet } from "lucide-react";
import DefaultLayout from "@/layouts/default";

export default function IndexPage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-6 py-8 md:py-10">
        <div className="inline-block max-w-2xl text-center justify-center pt-16">
          <span className={title()}>Trade&nbsp;</span>
          <span className={title({ color: "violet" })}>smarter&nbsp;</span>
          <br />
          <span className={title()}>
            with lightning-fast execution and advanced tools.
          </span>
          <div className={subtitle({ class: "mt-4" })}>
            Professional trading platform built with modern React UI components.
            <br />
            <span className="text-violet-600 font-semibold">Fast. Secure. Profitable.</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            className={buttonStyles({
              color: "primary",
              radius: "full",
              variant: "shadow",
            })}
            href="/trade"
          >
            <TrendingUp size={20} />
            Start Trading
          </Link>
          <Link
            className={buttonStyles({ 
              color: "secondary", 
              variant: "bordered", 
              radius: "full" 
            })}
            href={"/docs"}
          >
            <BarChart3 size={20} />
            Documentation
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4 mt-12">
          <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Zap className="text-green-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-800">Lightning Fast</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-sm text-gray-600">
                Execute trades in milliseconds with our optimized infrastructure and real-time market data.
              </p>
              <Chip color="success" variant="flat" size="sm" className="mt-2 w-fit">
                &lt;10ms latency
              </Chip>
            </CardBody>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-violet-50 to-purple-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Target className="text-violet-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-800">High Leverage</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-sm text-gray-600">
                Amplify your trading potential with leverage up to 100× on major cryptocurrency pairs.
              </p>
              <Chip color="secondary" variant="flat" size="sm" className="mt-2 w-fit">
                Up to 100× leverage
              </Chip>
            </CardBody>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-blue-50 to-cyan-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="text-blue-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-800">Secure Trading</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-sm text-gray-600">
                Trade with confidence using bank-grade security and cold storage protection.
              </p>
              <Chip color="primary" variant="flat" size="sm" className="mt-2 w-fit">
                Bank-grade security
              </Chip>
            </CardBody>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="w-full max-w-4xl px-4 mt-8">
          <Card className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white">
            <CardBody className="py-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-green-400">$2.4B+</div>
                  <div className="text-sm text-gray-300 mt-1">24h Volume</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-violet-400">150K+</div>
                  <div className="text-sm text-gray-300 mt-1">Active Traders</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-400">99.9%</div>
                  <div className="text-sm text-gray-300 mt-1">Uptime</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-yellow-400">24/7</div>
                  <div className="text-sm text-gray-300 mt-1">Support</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-8">
          <Snippet hideCopyButton hideSymbol variant="bordered">
            <span>
              Ready to start trading?{" "}
              <Code color="primary">Launch the trading interface</Code>
            </span>
          </Snippet>
        </div>

        {/* CTA Section */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wallet className="text-violet-600" size={20} />
            <span className="text-lg font-semibold text-gray-700">
              Connect your wallet and start trading in seconds
            </span>
          </div>
          <Link
            className={buttonStyles({
              color: "success",
              radius: "full",
              variant: "shadow",
              size: "lg"
            })}
            href="/trade"
          >
            <TrendingUp size={20} />
            Open Trading Dashboard
          </Link>
        </div>
      </section>
    </DefaultLayout>
  );
}