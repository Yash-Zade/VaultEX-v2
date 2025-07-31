import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import {
    Navbar as HeroUINavbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenuToggle,
} from "@heroui/navbar";
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    DropdownSection,
} from "@heroui/dropdown";
import { link as linkStyles } from "@heroui/theme";
import clsx from "clsx";
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import {
    XIcon,
    GithubIcon,
    LinkedInIcon,
} from "@/components/icons";
import logo from "@/assets/logo1.png";

export const Navbar = () => {
    const { connect, connectors } = useConnect();
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    // Format address to be more readable (0x1234...5678)
    const formatAddress = (address: string) => {
        if (!address) return "";
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <HeroUINavbar maxWidth="xl" position="sticky">
            <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
                <NavbarBrand className="gap-3 max-w-fit">
                    <Link
                        className="flex justify-start items-center gap-1"
                        color="foreground"
                        href="/">
                        <img
                            src={logo} width={40} alt="Logo" />
                        <p className="font-bold text-inherit text-2xl">VaultEX</p>
                    </Link>
                </NavbarBrand>
                <div className="hidden lg:flex gap-4 justify-start ml-2">
                    {siteConfig.navItems.map((item) => (
                        <NavbarItem key={item.href}>
                            <Link
                                className={clsx(
                                    linkStyles({ color: "foreground" }),
                                    "data-[active=true]:text-primary data-[active=true]:font-medium",
                                )}
                                color="foreground"
                                href={item.href}
                            >
                                {item.label}
                            </Link>
                        </NavbarItem>
                    ))}
                </div>
            </NavbarContent>

            <NavbarContent
                className="hidden sm:flex basis-1/5 sm:basis-full"
                justify="end"
            >
                <NavbarItem className="hidden sm:flex gap-2">
                    <Link isExternal href={siteConfig.links.x} title="X">
                        <XIcon className="text-default-500" />
                    </Link>
                    <Link isExternal href={siteConfig.links.linkedin} title="LindeinIn">
                        <LinkedInIcon className="text-default-500" />
                    </Link>
                    <Link isExternal href={siteConfig.links.github} title="GitHub">
                        <GithubIcon className="text-default-500" />
                    </Link>
                    <ThemeSwitch />
                </NavbarItem>
                <NavbarItem className="hidden md:flex">
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                className="text-sm font-normal bg-default-100"
                                variant="flat"
                                color={isConnected ? "success" : "default"}
                            >
                                {isConnected ? formatAddress(address!) : "Connect Wallet"}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Wallet options">
                            {isConnected ? (
                                <DropdownSection title="Wallet">
                                    <DropdownItem
                                        key="full-address"
                                        description="Click to copy"
                                        onClick={() => {
                                            navigator.clipboard.writeText(address!);
                                        }}
                                    >
                                        {address}
                                    </DropdownItem>
                                    <DropdownItem
                                        key="disconnect"
                                        className="text-danger"
                                        color="danger"
                                        onClick={() => disconnect()}
                                    >
                                        Disconnect
                                    </DropdownItem>
                                </DropdownSection>
                            ) : (
                                <DropdownSection title="Connect with">
                                    {connectors.map((connector) => (
                                        <DropdownItem
                                            key={connector.id}
                                            onClick={() => connect({ connector })}
                                        >
                                            {connector.name}
                                        </DropdownItem>
                                    ))}
                                </DropdownSection>
                            )}
                        </DropdownMenu>
                    </Dropdown>
                </NavbarItem>
            </NavbarContent>

            <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
                <Link isExternal href={siteConfig.links.github}>
                    <GithubIcon className="text-default-500" />
                </Link>
                <ThemeSwitch />
                <NavbarMenuToggle />
            </NavbarContent>

        </HeroUINavbar>
    );
};