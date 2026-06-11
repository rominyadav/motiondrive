import React from "react";
import { Menu, LayoutGrid, Search, List } from "lucide-react";
import { DriveMode } from "@/types/drive";

interface NavbarProps {
  session: any;
  setSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  explorerMode: DriveMode;
  viewMode: "table" | "icons";
  changeViewMode: (mode: "table" | "icons") => void;
}

export function Navbar({
  session,
  setSidebarOpen,
  searchQuery,
  setSearchQuery,
  explorerMode,
  viewMode,
  changeViewMode,
}: NavbarProps) {
  return (
    <>
      {/* MOBILE TOP HEADER BAR */}
      <div className="mobile-top-header">
        <button 
          onClick={() => setSidebarOpen(true)} 
          className="mobile-menu-btn" 
          title="Open Menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-brand">
          <LayoutGrid size={20} className="brand-accent" />
          <span>Motionsewa <span className="brand-accent">Drive</span></span>
        </div>
        <div className="mobile-user-avatar">
          {session?.user?.name?.charAt(0) || "U"}
        </div>
      </div>

      <header className="header">
        <div className="search-bar-container">
          <Search size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search files in organization drive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {explorerMode !== "links" && (
          <div className="view-mode-toggle" style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
            <button
              onClick={() => changeViewMode("table")}
              className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => changeViewMode("icons")}
              className={`toggle-btn ${viewMode === "icons" ? "active" : ""}`}
              title="Icons View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        )}
      </header>
    </>
  );
}
