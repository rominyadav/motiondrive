import React from "react";
import { LayoutGrid, Share2, Folder, Archive } from "lucide-react";
import { DriveMode } from "@/types/drive";
import { MobileTab } from "@/hooks/mobile/useMobileTabs";

interface BottomTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const tabs = [
    { id: "personal" as DriveMode, label: "My Drive", icon: LayoutGrid },
    { id: "shared" as DriveMode, label: "Shared", icon: Share2 },
    { id: "projects" as MobileTab, label: "Projects", icon: Folder },
    { id: "archive" as DriveMode, label: "Archive", icon: Archive }
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="Drive sections">
      <div className="bottom-tab-grid">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (activeTab === "personal" && tab.id === "personal");

          return (
            <button
              key={tab.id}
              type="button"
              className={`bottom-tab ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
