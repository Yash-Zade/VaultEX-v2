import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { title, subtitle } from "@/components/primitives";
import { Link } from "@heroui/link";
import { button as buttonStyles } from "@heroui/theme";
import { ShieldCheck, Landmark, Layers3, Users2, BookOpen, GitBranch } from "lucide-react";
import DefaultLayout from "@/layouts/default";

export default function AboutPage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center gap-10 py-16 px-6 md:px-12">
        {/* About Title */}
        <div className="max-w-3xl text-center">
          <h1 className={title()}>
            Built for&nbsp;
            <span className={title({ color: "violet" })}>DeFi Traders</span>
          </h1>
          <p className={subtitle({ class: "mt-4" })}>
            This platform is more than a product — it's a decentralized trading infrastructure.
            Our mission is to empower on-chain perpetual traders with speed, safety, and transparency.
          </p>
        </div>

        {/* Philosophy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex items-center space-x-2">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Landmark size={20} className="text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-800">Protocol First</h3>
            </CardHeader>
            <CardBody className="pt-0 text-sm text-gray-600">
              Every trade, margin update, and liquidation is executed by autonomous smart contracts — not a backend.
              <Chip size="sm" className="mt-2 w-fit" variant="flat" color="default">Trustless by design</Chip>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex items-center space-x-2">
              <div className="p-2 bg-violet-200 rounded-lg">
                <ShieldCheck size={20} className="text-violet-700" />
              </div>
              <h3 className="font-semibold text-gray-800">Security First</h3>
            </CardHeader>
            <CardBody className="pt-0 text-sm text-gray-600">
              Our contracts undergo continuous audits, and all funds remain non-custodial. You control your wallet at all times.
              <Chip size="sm" className="mt-2 w-fit" variant="flat" color="primary">Audited & Verified</Chip>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-blue-100 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex items-center space-x-2">
              <div className="p-2 bg-indigo-200 rounded-lg">
                <GitBranch size={20} className="text-indigo-700" />
              </div>
              <h3 className="font-semibold text-gray-800">Open Infrastructure</h3>
            </CardHeader>
            <CardBody className="pt-0 text-sm text-gray-600">
              From protocol logic to frontend components, everything is open-source — enabling transparency and contribution.
              <Chip size="sm" className="mt-2 w-fit" variant="flat" color="secondary">MIT Licensed</Chip>
            </CardBody>
          </Card>
        </div>

        {/* Our Vision */}
        <div className="w-full max-w-4xl mt-12">
          <Card className="bg-gradient-to-r from-white to-gray-50 shadow">
            <CardBody className="p-8 text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Our Vision
              </h3>
              <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
                We believe the future of trading lies in decentralized, composable finance.
                By removing centralized gatekeepers, we enable a new generation of traders to
                build, integrate, and operate freely on Ethereum — where the code is the law.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Join Community CTA */}
        <div className="text-center mt-12">
          <h4 className="text-lg font-semibold text-gray-700 mb-2">
            Want to contribute or build on top?
          </h4>
          <div className="flex flex-col md:flex-row items-center gap-3 justify-center mt-4">
            <Link
              className={buttonStyles({ color: "primary", variant: "shadow", radius: "full" })}
              href="/docs"
            >
              <BookOpen size={18} />
              Read the Docs
            </Link>
            <Link
              className={buttonStyles({ color: "secondary", variant: "flat", radius: "full" })}
              href="https://github.com/your-repo"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitBranch size={18} />
              Visit GitHub
            </Link>
            <Link
              className={buttonStyles({ color: "success", variant: "bordered", radius: "full" })}
              href="/community"
            >
              <Users2 size={18} />
              Join the Community
            </Link>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
