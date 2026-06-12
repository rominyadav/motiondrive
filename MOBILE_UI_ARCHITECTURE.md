# Mobile UI Architecture - Google Drive Style

## Overview
Transformed the desktop-heavy sidebar navigation into a mobile-first bottom tab navigation system with a clean, modular structure.

## Structure

### Primary Navigation (Bottom Tabs)
**Always visible on mobile (< 768px)**
- My Drive
- Shared Drive  
- Projects (opens picker modal)
- Archive

### Secondary Navigation (Drawer Sidebar)
**Accessible via hamburger menu**
- Shared Links
- Admin Panel (admin only)
- Storage Analytics
- User Profile
- Sign Out

### Floating Action Button (FAB)
**Fixed bottom-right, above bottom tabs**
- Upload File
- Upload Folder
- New Folder
- Create Text File
- Create Document
- Create Spreadsheet

## Component Architecture

```
src/
├── components/
│   ├── mobile/
│   │   ├── BottomTabBar.tsx        # Bottom navigation tabs
│   │   ├── MobileHeader.tsx        # Mobile header with search
│   │   ├── FloatingActionButton.tsx # FAB for create actions
│   │   ├── ProjectPickerModal.tsx   # Project selection modal
│   │   ├── MobileSidebar.tsx       # Secondary drawer menu
│   │   └── index.ts                # Barrel export
│   └── drive/
│       ├── Sidebar.tsx              # Desktop sidebar (unchanged)
│       ├── Navbar.tsx               # Desktop navbar (unchanged)
│       └── ...
├── hooks/
│   └── mobile/
│       └── useMobileTabs.ts        # Tab navigation logic
└── app/
    └── drive.css                    # All styles (desktop + mobile)
```

## Key Features

### 1. Bottom Tab Navigation
- 4 primary tabs always visible
- Active state with color and background highlight
- Smooth transitions
- Touch-friendly 64px height

### 2. Projects Tab
- Opens modal with categorized lists:
  - My Projects
  - Shared Projects  
  - Archive Projects
- Search-friendly
- Collapse/expand sections

### 3. FAB (Floating Action Button)
- Positioned bottom-right, 80px from bottom
- Expands to show 6 action options
- Color-coded icons
- Click outside to close

### 4. Mobile Header
- Sticky at top
- Hamburger menu (opens sidebar)
- Dynamic title based on current location
- Integrated search bar
- User avatar

### 5. Responsive Behavior

#### Mobile (<= 768px)
- Bottom tabs visible
- FAB visible
- Sidebar becomes drawer (slide-in)
- Desktop header hidden
- Content padded for bottom tabs (72px)

#### Desktop (> 768px)
- Desktop sidebar visible
- Bottom tabs hidden
- FAB hidden
- Traditional header visible
- Full-width layout

## Integration Points

### In page.tsx
```tsx
import { BottomTabBar, MobileHeader, FloatingActionButton, ProjectPickerModal, MobileSidebar } from "@/components/mobile";
import { useMobileTabs } from "@/hooks/mobile/useMobileTabs";

// Inside component:
const {
  activeTab,
  showProjectPicker,
  setShowProjectPicker,
  handleTabChange
} = useMobileTabs({
  explorerMode,
  selectProject,
  selectSharedDrive,
  selectArchiveDrive,
  setParams
});

// Render mobile components:
<MobileHeader ... />
<BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
<FloatingActionButton ... />
<ProjectPickerModal ... />
<MobileSidebar ... />
```

## CSS Organization

### Mobile-Specific Classes
- `.bottom-tab-bar` - Tab navigation container
- `.bottom-tab` - Individual tab button
- `.fab-container` - FAB wrapper
- `.fab-main` - Main FAB button
- `.fab-menu` - Expanded action menu
- `.mobile-header` - Mobile header container
- `.project-picker-modal` - Project selection modal
- `.mobile-sidebar` - Secondary drawer sidebar

### Responsive Breakpoints
- Desktop: `@media (min-width: 769px)`
- Mobile: `@media (max-width: 768px)`

## Design Principles

1. **Mobile-First**: Bottom tabs are the primary navigation
2. **Minimal**: Only essential actions in bottom tabs
3. **Accessible**: Large touch targets (44px minimum)
4. **Performant**: CSS transitions, no heavy JS
5. **Modular**: Each component is self-contained
6. **Clean Code**: Short functions, clear separation of concerns

## Backend Considerations
No backend changes required. All logic uses existing hooks and actions from:
- `useDriveNavigation`
- `useDriveActions`
- `useDriveTransfers`
- etc.

## Future Enhancements
- Swipe gestures for tab navigation
- Pull-to-refresh
- Offline mode indicators
- Bottom sheet for quick actions
- Haptic feedback on interactions
