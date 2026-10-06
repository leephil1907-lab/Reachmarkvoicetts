"use client";

import Link from "next/link";
import { Bell, Menu, Mic2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";

const nav = [["Dashboard","/dashboard"],["Voices","/voices"],["Agents","/agents"],["Conversations","/conversations"],["Automation","/automation"]];

export function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#050507]/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-7 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open navigation"><Menu size={20}/></Button>
        <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[.06]"><span className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-cyan-400/20 opacity-80"/><Mic2 size={17} className="relative"/></span>
          <span className="text-[15px] font-semibold tracking-[-.02em]">Reachmark<span className="text-white/35"> Voice</span></span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-white/[.06] bg-white/[.025] p-1 md:flex">
          {nav.map(([label, href]) => <Link key={href} href={href} className="rounded-full px-3.5 py-2 text-xs text-white/45 transition hover:bg-white/[.06] hover:text-white">{label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="hidden sm:inline-flex">EN</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>English</DropdownMenuItem><DropdownMenuItem>Français</DropdownMenuItem><DropdownMenuItem>日本語</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#56d9ff]"/></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><button className="ml-1 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-blue-500/20 text-[11px] font-semibold">RH</button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem>Profile</DropdownMenuItem><DropdownMenuItem>Settings</DropdownMenuItem><DropdownMenuItem>Logout</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>
    </header>
  );
}
