import React from "react";
import { LayoutGrid, Share2, Folder, Archive } from "lucide-react";
import { DriveMode } from "@/types/drive";

interface BottomTabBarProps {
  activeTab: DriveMode;
  onTabChange: (tab: DriveMode) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const tabs = [
    { id: "personal" as DriveMode, label: "My Drive", icon: LayoutGrid },
    { id: "shared" as DriveMode, label: "Shared", icon: Share2 },
    { id: "projects" as DriveMode, label: "Projects", icon: Folder },
    { id: "archive" as DriveMode, label: "Archive", icon: Archive }
  ];

  return (
    <div className="bottom-tab-bar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (activeTab === "personal" && tab.id === "personal");
        
        return (
          <button
            key={tab.id}
            className={`bottom-tab ${isActive ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
