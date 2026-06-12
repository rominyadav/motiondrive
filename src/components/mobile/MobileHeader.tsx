import React from "react";
import { Menu, Search } from "lucide-react";

interface MobileHeaderProps {
  onMenuOpen: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  title: string;
  userInitial: string;
}

export function MobileHeader({
  onMenuOpen,
  searchQuery,
  onSearchChange,
  title,
  userInitial
}: MobileHeaderProps) {
  return (
    <div className="mobile-header">
      <div className="mobile-header-top">
        <button onClick={onMenuOpen} className="mobile-menu-btn">
          <Menu size={24} />
        </button>
        <h1 className="mobile-header-title">{title}</h1>
        <div className="mobile-user-avatar">{userInitial}</div>
      </div>
      
      <div className="mobile-search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="mobile-search-input"
        />
      </div>
    </div>
  );
}
